"""
Payment — Louvin checkout proxy.
POST /api/v1/payment/checkout  { "plan": "koperasi" | "enterprise" }
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
try:
    import config.settings as settings
    from utils.auth import get_current_user
except ModuleNotFoundError:
    import be.config.settings as settings
    from be.utils.auth import get_current_user

router = APIRouter(prefix="/payment", tags=["payment"])

PLAN_AMOUNTS = {
    "koperasi": 49900,     # Rp 499.000 in cents/smallest unit — adjust to Louvin format
    "enterprise": 0,       # custom / negotiate
}

PLAN_LABELS = {
    "koperasi": "OtaruChain Koperasi — 1 bulan",
    "enterprise": "OtaruChain Enterprise — negosiasi",
}


class CheckoutRequest(BaseModel):
    plan: str


@router.post("/checkout")
async def checkout(body: CheckoutRequest, user: dict = Depends(get_current_user)):
    if not settings.LOUVIN_API_KEY:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")

    plan = body.plan.lower()
    if plan not in PLAN_AMOUNTS:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {plan}")

    payload = {
        "merchant_slug": settings.LOUVIN_SLUG,
        "amount": PLAN_AMOUNTS[plan],
        "currency": "IDR",
        "description": PLAN_LABELS[plan],
        "customer_email": user.get("email", ""),
        "metadata": {
            "plan": plan,
            "user_id": user["id"],
        },
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(
                f"{settings.LOUVIN_BASE_URL}/v1/transactions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.LOUVIN_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Payment gateway unreachable: {exc}")

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Payment gateway error: {resp.text}")

    data = resp.json()
    payment_url = data.get("payment_url") or data.get("checkout_url") or data.get("url")
    if not payment_url:
        raise HTTPException(status_code=502, detail="No payment URL returned from gateway")

    return {"payment_url": payment_url, "transaction_id": data.get("id")}
