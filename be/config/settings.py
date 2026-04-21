import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# JWT
JWT_SECRET: str = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM: str = "HS256"

# Louvin Payment
LOUVIN_BASE_URL: str = os.getenv("LOUVIN_BASE_URL", "https://api.louvin.dev")
LOUVIN_API_KEY: str = os.getenv("LOUVIN_API_KEY", "")
LOUVIN_SLUG: str = os.getenv("LOUVIN_SLUG", "otaruchain")

# App
CORS_ORIGINS: list[str] = [
    "https://otaruchain.vercel.app",
    "https://otaruchain.my.id",
    "http://localhost:5173",
    "http://localhost:5174",
]
