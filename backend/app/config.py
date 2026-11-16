import os
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

DEV_FALLBACK_JWT_SECRET = "dev-only-insecure-jwt-secret-change-in-production"


class Settings(BaseSettings):
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_USER: str = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "lscontrols")
    MYSQL_DATABASE: str = os.getenv("MYSQL_DATABASE", "smart_store")
    MYSQL_POOL_SIZE: int = int(os.getenv("MYSQL_POOL_SIZE", "10"))
    PORT: int = int(os.getenv("PORT", "8000"))
    PROJECTS_BASE_DIR: str = os.getenv("PROJECTS_BASE_DIR", "Z:\\PROJECTS")

    # Security & Auth
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", DEV_FALLBACK_JWT_SECRET)
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14"))
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    # App & Email (SMTP)
    APP_BASE_URL: str = os.getenv("APP_BASE_URL", "http://localhost:5173")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@appsuite.local")
    BILLING_WEBHOOK_SECRET: str = os.getenv("BILLING_WEBHOOK_SECRET", "")

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return origins or ["*"]

    @property
    def is_using_default_jwt_secret(self) -> bool:
        return self.JWT_SECRET_KEY == DEV_FALLBACK_JWT_SECRET


settings = Settings()
