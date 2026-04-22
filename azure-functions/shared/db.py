"""
Supabase client — singleton, created once on cold start and reused.
Prefers the service-role (admin) client for full access.
Falls back to anon client if service-role key is not set.
"""
from supabase import create_client, Client
from shared.settings import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# ─── Singleton clients (persist across invocations within an instance) ────────

_supabase: Client | None = None
_supabase_admin: Client | None = None


def _init_clients():
    global _supabase, _supabase_admin

    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is not configured")

    if SUPABASE_ANON_KEY:
        _supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    if SUPABASE_SERVICE_ROLE_KEY:
        _supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if not _supabase and not _supabase_admin:
        raise ValueError("Neither SUPABASE_ANON_KEY nor SUPABASE_SERVICE_ROLE_KEY is configured")


def get_db() -> Client:
    """Return the best available Supabase client (admin preferred)."""
    if _supabase_admin is None and _supabase is None:
        _init_clients()
    return _supabase_admin or _supabase  # type: ignore[return-value]


def get_admin_client() -> Client | None:
    """Return the admin (service-role) client, or None if not configured."""
    if _supabase_admin is None and _supabase is None:
        _init_clients()
    return _supabase_admin


def get_anon_client() -> Client | None:
    """Return the anon client, or None if not configured."""
    if _supabase_admin is None and _supabase is None:
        _init_clients()
    return _supabase
