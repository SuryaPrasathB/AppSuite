"""Re-export core employees router for backwards compatibility."""

from app.modules.core.routers.employees import router

__all__ = ["router"]
