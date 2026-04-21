"""
API Keys — generate / rotate / revoke / get own key.
One active key per user (1:1). Rotate = delete old, create new.
Table: public.api_keys
"""
import secrets
from fastapi import APIRouter, Depends, HTTPException
from config.db import supabase_admin, supabase
from utils.auth import get_current_user

router = APIRouter(prefix="/apikeys", tags=["apikeys"])

DB = supabase_admin or supabase


def _db():
    return supabase_admin or supabase


@router.get("/me")
async def get_my_key(user: dict = Depends(get_current_user)):
    res = _db().table("api_keys").select("*").eq("user_id", user["id"]).eq("is_active", True).maybe_single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="No active API key")
    return res.data


@router.post("/generate")
async def generate_key(user: dict = Depends(get_current_user)):
    """Generate a new key (or rotate if one already exists)."""
    db = _db()

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
        raise HTTPException(status_code=500, detail="Failed to create API key")
    return res.data[0]


@router.delete("/me")
async def revoke_key(user: dict = Depends(get_current_user)):
    _db().table("api_keys").update({"is_active": False}).eq("user_id", user["id"]).execute()
    return {"detail": "API key revoked"}
