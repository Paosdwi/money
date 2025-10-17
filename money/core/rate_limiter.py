"""Asynchronous rate limiting utilities."""
from __future__ import annotations

import asyncio
import time
from typing import Optional


class AsyncRateLimiter:
    """Token bucket rate limiter for async workflows."""

    def __init__(self, rate: float, capacity: Optional[int] = None) -> None:
        if rate <= 0:
            raise ValueError("rate must be positive")
        self.rate = rate
        self.capacity = capacity or max(1, int(rate))
        self._tokens = float(self.capacity)
        self._last_check = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            await self._refill()
            while self._tokens < 1:
                await asyncio.sleep(1 / self.rate)
                await self._refill()
            self._tokens -= 1

    async def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_check
        self._last_check = now
        self._tokens = min(self.capacity, self._tokens + elapsed * self.rate)
