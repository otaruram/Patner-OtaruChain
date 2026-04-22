"""
Environment variable loader for Azure Functions.
Azure injects app settings as environment variables — no dotenv needed.
"""
import os

# Supabase
SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY: str = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# JWT
JWT_SECRET: str = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM: str = "HS256"

# Louvin Payment
LOUVIN_BASE_URL: str = os.environ.get("LOUVIN_BASE_URL", "https://api.louvin.dev")
LOUVIN_API_KEY: str = os.environ.get("LOUVIN_API_KEY", "")
LOUVIN_SLUG: str = os.environ.get("LOUVIN_SLUG", "otaruchain")
PARTNER_SUCCESS_URL: str = os.environ.get(
    "PARTNER_SUCCESS_URL",
    "https://otaruchain.my.id/dashboard?payment=success",
)
PARTNER_CALLBACK_URL: str = os.environ.get(
    "PARTNER_CALLBACK_URL",
    "https://otaruchain-partner-api.azurewebsites.net/api/v1/payment/callback",
)

# CORS — configured in host.json, listed here for reference
CORS_ORIGINS: list[str] = [
    "https://otaruchain.vercel.app",
    "https://otaruchain.my.id",
    "http://localhost:5173",
    "http://localhost:5174",
]
