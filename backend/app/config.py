import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    @property
    def use_mock_db(self) -> bool:
        # If credentials are not set, fallback to mock in-memory DB
        return not self.SUPABASE_URL or not self.SUPABASE_KEY

settings = Settings()
