"""Thread-safe in-memory sliding-window rate limiter."""

from collections import defaultdict, deque
import threading
import time
from typing import Deque, Dict
from fastapi import HTTPException

_lock = threading.Lock()
_buckets: Dict[str, Deque[float]] = defaultdict(deque)


def enforce_rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    """Record an attempt for `key` and raise 429 if limit is exceeded."""
    now = time.monotonic()
    cutoff = now - window_seconds

    with _lock:
        q = _buckets[key]
        while q and q[0] <= cutoff:
            q.popleft()
        if len(q) >= max_attempts:
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait a moment and try again.",
            )
        q.append(now)


def clear_rate_limit(key: str) -> None:
    """Clear recorded attempts for `key` (e.g., after a successful login)."""
    with _lock:
        _buckets.pop(key, None)
