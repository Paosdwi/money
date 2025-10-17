"""Retry helpers for async tasks."""
from __future__ import annotations

import asyncio
from typing import Awaitable, Callable, Iterable, Type


async def retry_async(
    operation: Callable[[], Awaitable],
    exceptions: Iterable[Type[BaseException]],
    attempts: int = 3,
    backoff_base: float = 0.5,
) -> object:
    """Execute ``operation`` with exponential backoff."""

    last_exc: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await operation()
        except tuple(exceptions) as exc:  # type: ignore[arg-type]
            last_exc = exc
            if attempt == attempts:
                break
            await asyncio.sleep(backoff_base * (2 ** (attempt - 1)))
    if last_exc:
        raise last_exc
    raise RuntimeError("retry_async exhausted without executing operation")
