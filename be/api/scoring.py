"""
Credit Scoring — lookup by email.
GET /api/v1/scoring/{email}
Requires: x-api-key header (partner API key from api_keys table)
"""
from fastapi import APIRouter, Header, HTTPException
from config.db import supabase_admin, supabase

router = APIRouter(prefix="/scoring", tags=["scoring"])

RISK_THRESHOLDS = {"PRIME": 80, "MODERATE": 50}


def _db():
    return supabase_admin or supabase


def _compute_risk(trust_score: float) -> str:
    if trust_score >= RISK_THRESHOLDS["PRIME"]:
        return "PRIME"
    if trust_score >= RISK_THRESHOLDS["MODERATE"]:
        return "MODERATE"
    return "RISK"


@router.get("/{email}")
async def get_scoring(email: str, x_api_key: str = Header(..., alias="x-api-key")):
    db = _db()

    # Validate API key
    key_res = (
        db.table("api_keys")
        .select("user_id")
        .eq("key_value", x_api_key)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not key_res.data:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")

    # Update last_used_at (best-effort)
    try:
        db.table("api_keys").update({"last_used_at": "now()"}).eq("key_value", x_api_key).execute()
    except Exception:
        pass

    # Find user by email — try profiles first, then admin list_users
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
    elif supabase_admin:
        # Fall back to admin list_users search
        try:
            users_resp = supabase_admin.auth.admin.list_users()
            for u in (users_resp or []):
                if u.email and u.email.lower() == email.lower():
                    target_user_id = str(u.id)
                    break
        except Exception:
            pass

    if not target_user_id:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch scans for this user
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

    return {
        "email": target_email,
        "user_id": target_user_id,
        "trust_score": trust_score,
        "risk_label": risk_label,
        "total_scans": total_scans,
        "verified_scans": verified_scans,
        "tampered_scans": tampered_scans,
        "total_nominal": total_nominal,
        "recent_scans": recent_scans,
    }
