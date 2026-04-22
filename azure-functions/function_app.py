"""
OtaruChain Partner API — Azure Functions (Python v2)
Serverless replacement for the FastAPI/Docker backend.

Endpoints:
  GET    /api/v1/partner/stats       — Public platform statistics
  GET    /api/v1/apikeys/me          — Get current user's API key
  DELETE /api/v1/apikeys/me          — Revoke current user's API key
  POST   /api/v1/apikeys/generate    — Generate/rotate API key
  POST   /api/v1/payment/checkout    — Create Louvin payment checkout
  GET    /api/v1/scoring/{email}     — Credit scoring lookup (requires x-api-key)
  GET    /health                     — Health check
"""

import azure.functions as func
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone

import httpx

from shared.db import get_db, get_admin_client
from shared.auth import validate_token
from shared import settings

# ─── App ──────────────────────────────────────────────────────────────────────

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
logger = logging.getLogger("otaruchain")

PLAN_DURATIONS_DAYS = {
    "koperasi": 30,
    "enterprise": 30,
}


def _json(data, status_code: int = 200) -> func.HttpResponse:
    """Shorthand for JSON response."""
    return func.HttpResponse(
        json.dumps(data, default=str),
        status_code=status_code,
        mimetype="application/json",
    )


def _error(detail: str, status_code: int = 400) -> func.HttpResponse:
    return _json({"detail": detail}, status_code)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _activate_subscription(db, user_id: str, plan: str, payment_reference: str | None = None, status: str = "active") -> None:
    started_at = datetime.now(timezone.utc)
    expires_at = started_at + timedelta(days=PLAN_DURATIONS_DAYS.get(plan, 30))
    db.table("partner_subscriptions").upsert(
        {
            "user_id": user_id,
            "plan": plan,
            "status": status,
            "started_at": started_at.isoformat(),
            "expires_at": expires_at.isoformat(),
            "payment_reference": payment_reference,
            "updated_at": _now_iso(),
        },
        on_conflict="user_id",
    ).execute()


def _record_payment(db, user_id: str, plan: str, amount: int, payment_url: str | None, transaction_id: str | None, status: str, raw_response: dict) -> None:
    db.table("partner_payments").insert(
        {
            "user_id": user_id,
            "plan": plan,
            "amount": amount,
            "currency": "IDR",
            "provider": "louvin",
            "provider_transaction_id": transaction_id,
            "payment_url": payment_url,
            "status": status,
            "raw_response": raw_response,
        }
    ).execute()


# ─── Health / Root ────────────────────────────────────────────────────────────


@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return _json({"status": "ok"})


@app.route(route="", methods=["GET"])
def root(req: func.HttpRequest) -> func.HttpResponse:
    return _json({"service": "OtaruChain Partner API", "status": "ok", "runtime": "azure-functions"})


# ─── Stats (public, no auth) ─────────────────────────────────────────────────


@app.route(route="api/v1/partner/stats", methods=["GET"])
def partner_stats(req: func.HttpRequest) -> func.HttpResponse:
    db = get_db()
    try:
        total_res = db.table("fraud_scans").select("id", count="exact").execute()
        total = total_res.count or 0

        verified_res = db.table("fraud_scans").select("id", count="exact").eq("status", "verified").execute()
        verified = verified_res.count or 0

        tampered_res = db.table("fraud_scans").select("id", count="exact").eq("status", "tampered").execute()
        tampered = tampered_res.count or 0

        fraud_prevented = tampered
        integrity_rate = round((verified / total * 100), 1) if total > 0 else 0.0
    except Exception as exc:
        logger.warning("Stats query failed: %s", exc)
        total = verified = fraud_prevented = 0
        integrity_rate = 0.0

    return _json({
        "total_scans": total,
        "fraud_prevented": fraud_prevented,
        "verified_scans": verified,
        "integrity_rate": integrity_rate,
    })


# ─── API Keys ────────────────────────────────────────────────────────────────


@app.route(route="api/v1/apikeys/me", methods=["GET", "DELETE"])
def apikeys_me(req: func.HttpRequest) -> func.HttpResponse:
    user = validate_token(req)
    if isinstance(user, func.HttpResponse):
        return user

    db = get_db()

    # ── DELETE: revoke ────────────────────────────────────────────────────
    if req.method == "DELETE":
        db.table("api_keys").update({"is_active": False}).eq("user_id", user["id"]).execute()
        return _json({"detail": "API key revoked"})

    # ── GET: fetch active key ─────────────────────────────────────────────
    res = (
        db.table("api_keys")
        .select("*")
        .eq("user_id", user["id"])
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not res.data:
        return _error("No active API key", 404)

    return _json(res.data)


@app.route(route="api/v1/apikeys/generate", methods=["POST"])
def apikeys_generate(req: func.HttpRequest) -> func.HttpResponse:
    """Generate a new API key (or rotate if one already exists)."""
    user = validate_token(req)
    if isinstance(user, func.HttpResponse):
        return user

    db = get_db()

    # Deactivate any existing key
    db.table("api_keys").update({"is_active": False}).eq("user_id", user["id"]).execute()

    new_key = f"ok_{secrets.token_hex(24)}"
    res = (
        db.table("api_keys")
        .insert({
            "user_id": user["id"],
            "key_value": new_key,
            "name": "default",
            "is_active": True,
        })
        .execute()
    )

    if not res.data:
        return _error("Failed to create API key", 500)

    return _json(res.data[0])


@app.route(route="api/v1/subscription/me", methods=["GET"])
def subscription_me(req: func.HttpRequest) -> func.HttpResponse:
    user = validate_token(req)
    if isinstance(user, func.HttpResponse):
        return user

    db = get_db()
    try:
        res = (
            db.table("partner_subscriptions")
            .select("*")
            .eq("user_id", user["id"])
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return _json({"status": "none"})
        return _json(rows[0])
    except Exception as exc:
        logger.warning("Subscription lookup failed: %s", exc)
        return _json({"status": "none"})


# ─── Payment ─────────────────────────────────────────────────────────────────

PLAN_AMOUNTS = {
    "koperasi": 49900,
    "enterprise": 0,
}

PLAN_LABELS = {
    "koperasi": "OtaruChain Koperasi — 1 bulan",
    "enterprise": "OtaruChain Enterprise — negosiasi",
}


@app.route(route="api/v1/payment/checkout", methods=["POST"])
def payment_checkout(req: func.HttpRequest) -> func.HttpResponse:
    user = validate_token(req)
    if isinstance(user, func.HttpResponse):
        return user

    if not settings.LOUVIN_API_KEY:
        return _error("Payment gateway not configured", 503)

    try:
        body = req.get_json()
    except ValueError:
        return _error("Invalid JSON body", 400)

    plan = (body.get("plan") or "").lower()
    if plan not in PLAN_AMOUNTS:
        return _error(f"Unknown plan: {plan}", 400)

    payload = {
        "merchant_slug": settings.LOUVIN_SLUG,
        "amount": PLAN_AMOUNTS[plan],
        "currency": "IDR",
        "description": PLAN_LABELS[plan],
        "customer_email": user.get("email", ""),
        "redirect_url": settings.PARTNER_SUCCESS_URL,
        "callback_url": settings.PARTNER_CALLBACK_URL,
        "metadata": {
            "plan": plan,
            "user_id": user["id"],
        },
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{settings.LOUVIN_BASE_URL}/v1/transactions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.LOUVIN_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
    except httpx.RequestError as exc:
        logger.error("Payment gateway unreachable: %s", exc)
        return _error(f"Payment gateway unreachable: {exc}", 502)

    if resp.status_code not in (200, 201):
        logger.error("Payment gateway error %d: %s", resp.status_code, resp.text)
        return _error(f"Payment gateway error: {resp.text}", 502)

    data = resp.json()
    payment_url = data.get("payment_url") or data.get("checkout_url") or data.get("url")
    transaction_id = data.get("id") or data.get("transaction_id") or data.get("reference")
    if not payment_url:
        return _error("No payment URL returned from gateway", 502)

    try:
        _record_payment(db, user["id"], plan, PLAN_AMOUNTS[plan], payment_url, transaction_id, "pending", data)
        _activate_subscription(db, user["id"], plan, payment_reference=transaction_id, status="pending")
    except Exception as exc:
        logger.warning("Failed to persist payment/subscription state: %s", exc)

    return _json({"payment_url": payment_url, "transaction_id": transaction_id})


@app.route(route="api/v1/payment/callback", methods=["POST"])
def payment_callback(req: func.HttpRequest) -> func.HttpResponse:
    db = get_db()

    try:
        body = req.get_json()
    except ValueError:
        return _error("Invalid JSON body", 400)

    transaction_id = body.get("id") or body.get("transaction_id") or body.get("reference")
    status = (body.get("status") or body.get("payment_status") or "").lower()
    metadata = body.get("metadata") or {}
    user_id = metadata.get("user_id") or body.get("user_id")
    plan = (metadata.get("plan") or body.get("plan") or "koperasi").lower()

    if not transaction_id:
        return _error("Missing transaction id", 400)

    try:
        db.table("partner_payments").update(
            {
                "status": status or "unknown",
                "raw_response": body,
                "updated_at": _now_iso(),
            }
        ).eq("provider_transaction_id", transaction_id).execute()

        if user_id and status in {"paid", "success", "settlement", "completed"}:
            _activate_subscription(db, user_id, plan, payment_reference=transaction_id, status="active")
    except Exception as exc:
        logger.warning("Payment callback persistence failed: %s", exc)

    return _json({"ok": True})


# ─── Scoring ──────────────────────────────────────────────────────────────────

RISK_THRESHOLDS = {"PRIME": 80, "MODERATE": 50}


def _compute_risk(trust_score: float) -> str:
    if trust_score >= RISK_THRESHOLDS["PRIME"]:
        return "PRIME"
    if trust_score >= RISK_THRESHOLDS["MODERATE"]:
        return "MODERATE"
    return "RISK"


@app.route(route="api/v1/scoring/{email}", methods=["GET"])
def scoring_lookup(req: func.HttpRequest) -> func.HttpResponse:
    email = req.route_params.get("email", "")
    if not email:
        return _error("Email parameter is required", 400)

    # ── Validate x-api-key ────────────────────────────────────────────────
    api_key = req.headers.get("x-api-key", "")
    if not api_key:
        return _error("x-api-key header is required", 401)

    db = get_db()

    key_res = (
        db.table("api_keys")
        .select("user_id")
        .eq("key_value", api_key)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not key_res.data:
        return _error("Invalid or inactive API key", 401)

    # Update last_used_at (best-effort)
    try:
        db.table("api_keys").update({"last_used_at": "now()"}).eq("key_value", api_key).execute()
    except Exception:
        pass

    # ── Find user by email ────────────────────────────────────────────────
    target_user_id: str | None = None
    target_email: str = email

    profile_res = (
        db.table("profiles")
        .select("id, user_email")
        .eq("user_email", email)
        .maybe_single()
        .execute()
    )
    if profile_res.data:
        target_user_id = profile_res.data["id"]
    else:
        # Fall back to admin list_users search
        admin = get_admin_client()
        if admin:
            try:
                users_resp = admin.auth.admin.list_users()
                for u in (users_resp or []):
                    if u.email and u.email.lower() == email.lower():
                        target_user_id = str(u.id)
                        break
            except Exception as exc:
                logger.warning("Admin list_users failed: %s", exc)

    if not target_user_id:
        return _error("User not found", 404)

    # ── Fetch scans ───────────────────────────────────────────────────────
    scans_res = (
        db.table("fraud_scans")
        .select("id, status, nominal_total, vendor_name, doc_type, created_at")
        .eq("user_id", target_user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    scans = scans_res.data or []

    total_scans = len(scans)
    verified_scans = sum(1 for s in scans if s.get("status") == "verified")
    tampered_scans = sum(1 for s in scans if s.get("status") == "tampered")
    total_nominal = sum(s.get("nominal_total") or 0 for s in scans if s.get("status") == "verified")

    trust_score = round((verified_scans / total_scans * 100), 1) if total_scans > 0 else 0.0
    risk_label = _compute_risk(trust_score)

    recent_scans = [
        {
            "scan_id": s["id"],
            "status": s["status"],
            "nominal_total": s.get("nominal_total"),
            "vendor_name": s.get("vendor_name"),
            "doc_type": s.get("doc_type"),
            "created_at": s["created_at"],
        }
        for s in scans[:10]
    ]

    return _json({
        "email": target_email,
        "user_id": target_user_id,
        "trust_score": trust_score,
        "risk_label": risk_label,
        "total_scans": total_scans,
        "verified_scans": verified_scans,
        "tampered_scans": tampered_scans,
        "total_nominal": total_nominal,
        "recent_scans": recent_scans,
    })
