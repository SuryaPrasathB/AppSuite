import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_USER: str = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "lscontrols")
    MYSQL_DATABASE: str = os.getenv("MYSQL_DATABASE", "smart_store")
    PORT: int = int(os.getenv("PORT", "8000"))
    PROJECTS_BASE_DIR: str = os.getenv("PROJECTS_BASE_DIR", "Z:\\PROJECTS")

settings = Settings()
