from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

try:
    from config.db import supabase_admin, supabase
    from config.settings import JWT_SECRET, JWT_ALGORITHM
except ModuleNotFoundError:
    from be.config.db import supabase_admin, supabase
    from be.config.settings import JWT_SECRET, JWT_ALGORITHM

try:
    from jose import jwt, JWTError
    _JOSE_AVAILABLE = True
except ImportError:
    _JOSE_AVAILABLE = False

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    """
    Validate Supabase Bearer token — 3-layer fallback:
      1. supabase_admin.auth.get_user(token)  — best (service role, bypasses anon restrictions)
      2. supabase.auth.get_user(token)         — anon client fallback
      3. JWT decode with JWT_SECRET            — last resort (no network, works offline/Azure)
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = credentials.credentials

    # Layer 1: admin client
    if supabase_admin:
        try:
            resp = supabase_admin.auth.get_user(token)
            if resp and resp.user:
                return {"id": str(resp.user.id), "email": resp.user.email or ""}
        except Exception:
            pass

    # Layer 2: anon client
    try:
        resp = supabase.auth.get_user(token)
        if resp and resp.user:
            return {"id": str(resp.user.id), "email": resp.user.email or ""}
    except Exception:
        pass

    # Layer 3: direct JWT decode (Supabase tokens are signed with JWT_SECRET)
    if _JOSE_AVAILABLE and JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"verify_aud": False},
            )
            sub = payload.get("sub")
            email = payload.get("email", "")
            if sub:
                return {"id": str(sub), "email": email}
        except JWTError:
            pass

    raise HTTPException(status_code=401, detail="Invalid or expired token")
