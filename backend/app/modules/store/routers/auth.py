"""Re-export core auth router for backwards compatibility."""

from app.modules.core.routers.auth import router

__all__ = ["router"]
