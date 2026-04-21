"""
Partner public stats (no auth required).
GET /api/v1/partner/stats
"""
from fastapi import APIRouter
from config.db import supabase_admin, supabase

router = APIRouter(prefix="/partner", tags=["partner"])


def _db():
    return supabase_admin or supabase


@router.get("/stats")
async def partner_stats():
    db = _db()
    try:
        # Count from fraud_scans table (same table used by OCR main app + Telegram)
        total_res = db.table("fraud_scans").select("id", count="exact").execute()
        total = total_res.count or 0

        verified_res = db.table("fraud_scans").select("id", count="exact").eq("status", "verified").execute()
        verified = verified_res.count or 0

        tampered_res = db.table("fraud_scans").select("id", count="exact").eq("status", "tampered").execute()
        tampered = tampered_res.count or 0

        fraud_prevented = tampered
        integrity_rate = round((verified / total * 100), 1) if total > 0 else 0.0
    except Exception:
        total = verified = fraud_prevented = 0
        integrity_rate = 0.0

    return {
        "total_scans": total,
        "fraud_prevented": fraud_prevented,
        "verified_scans": verified,
        "integrity_rate": integrity_rate,
    }
