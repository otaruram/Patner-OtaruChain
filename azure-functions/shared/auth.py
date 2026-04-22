"""
Auth helper — validates Supabase Bearer tokens.
Returns a user dict on success or an HttpResponse (401) on failure.
"""
import json
import logging
import azure.functions as func
from shared.db import get_admin_client, get_anon_client
from shared.settings import JWT_ALGORITHM, JWT_SECRET

try:
    from jose import JWTError, jwt
    _JOSE_AVAILABLE = True
except ImportError:
    JWTError = Exception
    jwt = None
    _JOSE_AVAILABLE = False

logger = logging.getLogger(__name__)


def validate_token(req: func.HttpRequest) -> dict | func.HttpResponse:
    """
    Extract and validate the Supabase Bearer token from the Authorization header.

    Returns:
        dict: {"id": str, "email": str} on success
        func.HttpResponse: 401 error response on failure
    """
    auth_header = req.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return _error_response("Missing authorization token")

    token = auth_header[7:]  # strip "Bearer "

    admin_client = get_admin_client()
    if admin_client is not None:
        try:
            resp = admin_client.auth.get_user(token)
            if resp and resp.user:
                return {"id": str(resp.user.id), "email": resp.user.email or ""}
        except Exception as exc:
            logger.warning("Admin token validation failed: %s", exc)

    anon_client = get_anon_client()
    if anon_client is not None:
        try:
            resp = anon_client.auth.get_user(token)
            if resp and resp.user:
                return {"id": str(resp.user.id), "email": resp.user.email or ""}
        except Exception as exc:
            logger.warning("Anon token validation failed: %s", exc)

    if _JOSE_AVAILABLE and JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"verify_aud": False},
            )
            subject = payload.get("sub")
            email = payload.get("email", "")
            if subject:
                return {"id": str(subject), "email": email}
        except JWTError as exc:
            logger.warning("JWT fallback validation failed: %s", exc)

    return _error_response("Invalid or expired token")


def _error_response(detail: str) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"detail": detail}),
        status_code=401,
        mimetype="application/json",
    )
