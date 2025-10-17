"""Base classes for exchange connectivity."""
from __future__ import annotations

import asyncio
import contextlib
import json
from typing import Any, Awaitable, Callable, Dict, Optional

import httpx
import websockets
from websockets.exceptions import ConnectionClosed

from ..core import AlertManager, ApiKeyStore, AsyncRateLimiter, retry_async


class ExchangeConnector:
    """Provides REST and WebSocket helpers with retries and rate limiting."""

    def __init__(
        self,
        name: str,
        rest_base: str,
        ws_base: Optional[str],
        api_keys: ApiKeyStore,
        rate_limiter: Optional[AsyncRateLimiter] = None,
        alert_manager: Optional[AlertManager] = None,
        rest_timeout: float = 10.0,
    ) -> None:
        self.name = name
        self.rest_base = rest_base.rstrip("/")
        self.ws_base = ws_base.rstrip("/") if ws_base else None
        self.api_keys = api_keys
        self.rate_limiter = rate_limiter
        self.alerts = alert_manager or AlertManager()
        self._client = httpx.AsyncClient(base_url=self.rest_base, timeout=rest_timeout)

    async def _rate_limit(self) -> None:
        if self.rate_limiter:
            await self.rate_limiter.acquire()

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        url = f"{self.rest_base}/{path.lstrip('/') }"

        async def operation() -> httpx.Response:
            await self._rate_limit()
            request_kwargs = await self._prepare_request_kwargs(method, path, kwargs)
            response = await self._client.request(method, url, **request_kwargs)
            response.raise_for_status()
            return response

        return await retry_async(operation, (httpx.HTTPError,))

    async def _prepare_request_kwargs(
        self, method: str, path: str, kwargs: Dict[str, Any]
    ) -> Dict[str, Any]:
        headers = kwargs.pop("headers", {})
        requires_auth = kwargs.pop("requires_auth", False)
        auth_headers = await self._auth_headers(method, path, kwargs, requires_auth)
        headers.update(auth_headers)
        return {**kwargs, "headers": headers}

    async def _auth_headers(
        self, method: str, path: str, kwargs: Dict[str, Any], requires_auth: bool
    ) -> Dict[str, str]:
        return {}

    async def get_json(self, path: str, **kwargs: Any) -> Any:
        response = await self._request("GET", path, **kwargs)
        return response.json()

    async def post_json(self, path: str, payload: Dict[str, Any]) -> Any:
        response = await self._request("POST", path, json=payload)
        return response.json()

    async def stream_websocket(
        self,
        path: str,
        on_message: Callable[[Dict[str, Any]], Awaitable[None]],
        heartbeat_interval: float = 15.0,
    ) -> None:
        if not self.ws_base:
            raise RuntimeError(f"{self.name} does not expose a WebSocket endpoint")

        url = f"{self.ws_base}/{path.lstrip('/') }"
        backoff = 1.0
        while True:
            try:
                self.alerts.info(f"Connecting to {self.name} websocket {url}")
                async with websockets.connect(url, ping_interval=None) as ws:
                    await self._on_ws_connected(ws)
                    heartbeat = asyncio.create_task(self._heartbeat(ws, heartbeat_interval))
                    try:
                        async for raw in ws:
                            try:
                                payload = json.loads(raw)
                            except json.JSONDecodeError:
                                self.alerts.warning(
                                    f"{self.name} websocket received invalid JSON", {"payload": raw}
                                )
                                continue
                            await on_message(payload)
                    finally:
                        heartbeat.cancel()
                        with contextlib.suppress(asyncio.CancelledError):
                            await heartbeat
            except (ConnectionClosed, OSError) as exc:
                self.alerts.warning(
                    f"{self.name} websocket disconnected", {"error": str(exc), "url": url}
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60.0)
            except Exception as exc:  # pragma: no cover - defensive
                self.alerts.critical(
                    f"{self.name} websocket fatal error", {"error": str(exc), "url": url}
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60.0)
            else:
                backoff = 1.0

    async def _heartbeat(self, ws: websockets.WebSocketClientProtocol, interval: float) -> None:
        try:
            while True:
                await asyncio.sleep(interval)
                await ws.ping()
        except ConnectionClosed:
            return

    async def _on_ws_connected(self, ws: websockets.WebSocketClientProtocol) -> None:
        return None

    async def close(self) -> None:
        await self._client.aclose()
