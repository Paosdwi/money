"""Binance exchange connector."""
from __future__ import annotations

import hashlib
import hmac
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

import httpx

from .base import ExchangeConnector
from ..core import ApiKeyStore, AlertManager, AsyncRateLimiter
from ..models import OrderBookLevel, OrderBookSnapshot, PricePoint, VolumePoint, WalletEvent, WalletEventType


class BinanceConnector(ExchangeConnector):
    def __init__(
        self,
        api_keys: ApiKeyStore,
        rate_limiter: AsyncRateLimiter | None = None,
        alert_manager: AlertManager | None = None,
    ) -> None:
        super().__init__(
            name="binance",
            rest_base="https://api.binance.com",
            ws_base="wss://stream.binance.com:9443/ws",
            api_keys=api_keys,
            rate_limiter=rate_limiter,
            alert_manager=alert_manager,
        )

    async def fetch_price(self, symbol: str) -> PricePoint:
        data = await self.get_json("api/v3/ticker/price", params={"symbol": symbol.upper()})
        return PricePoint(
            exchange=self.name,
            symbol=symbol.upper(),
            price=float(data["price"]),
            timestamp=datetime.now(timezone.utc),
            source="rest",
        )

    async def fetch_volume(self, symbol: str) -> VolumePoint:
        data = await self.get_json("api/v3/ticker/24hr", params={"symbol": symbol.upper()})
        return VolumePoint(
            exchange=self.name,
            symbol=symbol.upper(),
            base_volume=float(data["volume"]),
            quote_volume=float(data["quoteVolume"]),
            timestamp=datetime.now(timezone.utc),
        )

    async def fetch_order_book(self, symbol: str, depth: int = 50) -> OrderBookSnapshot:
        data = await self.get_json(
            "api/v3/depth", params={"symbol": symbol.upper(), "limit": depth}
        )
        bids = [OrderBookLevel(price=float(p), size=float(q)) for p, q in data["bids"]]
        asks = [OrderBookLevel(price=float(p), size=float(q)) for p, q in data["asks"]]
        return OrderBookSnapshot(
            exchange=self.name,
            symbol=symbol.upper(),
            bids=bids,
            asks=asks,
            timestamp=datetime.now(timezone.utc),
        )

    async def fetch_wallet_events(self) -> List[WalletEvent]:
        withdrawals = await self.get_json(
            "sapi/v1/capital/withdraw/history",
            params={},
            requires_auth=True,
        )
        result: List[WalletEvent] = []
        for item in withdrawals:
            result.append(
                WalletEvent(
                    exchange=self.name,
                    asset=item["coin"],
                    amount=-float(item["amount"]),
                    event_type=WalletEventType.WITHDRAWAL,
                    timestamp=datetime.fromtimestamp(int(item["applyTime"]) / 1000, tz=timezone.utc),
                    tx_id=item.get("txId"),
                    metadata={"status": item.get("status")},
                )
            )
        deposits = await self.get_json(
            "sapi/v1/capital/deposit/hisrec",
            params={},
            requires_auth=True,
        )
        for item in deposits:
            result.append(
                WalletEvent(
                    exchange=self.name,
                    asset=item["coin"],
                    amount=float(item["amount"]),
                    event_type=WalletEventType.DEPOSIT,
                    timestamp=datetime.fromtimestamp(int(item["insertTime"]) / 1000, tz=timezone.utc),
                    tx_id=item.get("txId"),
                    metadata={"status": item.get("status")},
                )
            )
        return result

    async def _auth_headers(
        self, method: str, path: str, kwargs: Dict[str, Any], requires_auth: bool
    ) -> Dict[str, str]:
        if not requires_auth:
            return {}
        credentials = self.api_keys.get_key(self.name)
        if not credentials:
            raise RuntimeError("Missing API credentials for Binance")
        params = kwargs.setdefault("params", {})
        params.setdefault("timestamp", int(time.time() * 1000))
        query = httpx.QueryParams(params).to_str()  # type: ignore[name-defined]
        signature = hmac.new(
            credentials.secret.encode(), query.encode(), hashlib.sha256
        ).hexdigest()
        params["signature"] = signature
        headers = {"X-MBX-APIKEY": credentials.key}
        return headers
