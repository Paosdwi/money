"""Coinbase exchange connector."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

import httpx

from .base import ExchangeConnector
from ..core import AlertManager, ApiKeyStore, AsyncRateLimiter
from ..models import OrderBookLevel, OrderBookSnapshot, PricePoint, VolumePoint, WalletEvent, WalletEventType


class CoinbaseConnector(ExchangeConnector):
    def __init__(
        self,
        api_keys: ApiKeyStore,
        rate_limiter: AsyncRateLimiter | None = None,
        alert_manager: AlertManager | None = None,
    ) -> None:
        super().__init__(
            name="coinbase",
            rest_base="https://api.exchange.coinbase.com",
            ws_base="wss://ws-feed.exchange.coinbase.com",
            api_keys=api_keys,
            rate_limiter=rate_limiter,
            alert_manager=alert_manager,
        )

    async def fetch_price(self, product_id: str) -> PricePoint:
        data = await self.get_json(f"products/{product_id}/ticker")
        return PricePoint(
            exchange=self.name,
            symbol=product_id,
            price=float(data["price"]),
            timestamp=datetime.now(timezone.utc),
            source="rest",
        )

    async def fetch_volume(self, product_id: str) -> VolumePoint:
        data = await self.get_json(f"products/{product_id}/stats")
        return VolumePoint(
            exchange=self.name,
            symbol=product_id,
            base_volume=float(data["volume"]),
            quote_volume=float(data.get("volume_30day", 0.0)),
            timestamp=datetime.now(timezone.utc),
        )

    async def fetch_order_book(self, product_id: str, level: int = 2) -> OrderBookSnapshot:
        data = await self.get_json(f"products/{product_id}/book", params={"level": level})
        bids = [OrderBookLevel(price=float(price), size=float(size)) for price, size, *_ in data["bids"]]
        asks = [OrderBookLevel(price=float(price), size=float(size)) for price, size, *_ in data["asks"]]
        return OrderBookSnapshot(
            exchange=self.name,
            symbol=product_id,
            bids=bids,
            asks=asks,
            timestamp=datetime.now(timezone.utc),
        )

    async def fetch_wallet_events(self, profile_id: str | None = None) -> List[WalletEvent]:
        params: Dict[str, Any] = {}
        if profile_id:
            params["profile_id"] = profile_id
        transfers = await self.get_json("transfers", params=params, requires_auth=True)
        events: List[WalletEvent] = []
        for transfer in transfers:
            raw_type = transfer.get("type", "")
            if raw_type == "deposit":
                event_type = WalletEventType.DEPOSIT
            elif raw_type == "withdraw" or raw_type == "withdrawal":
                event_type = WalletEventType.WITHDRAWAL
            else:
                event_type = WalletEventType.TRANSFER
            amount = float(transfer["amount"])
            if event_type == WalletEventType.WITHDRAWAL and amount > 0:
                amount = -amount
            events.append(
                WalletEvent(
                    exchange=self.name,
                    asset=transfer["currency"],
                    amount=amount,
                    event_type=event_type,
                    timestamp=datetime.fromisoformat(transfer["created_at"].replace("Z", "+00:00")),
                    tx_id=transfer.get("id"),
                    metadata={"completed_at": transfer.get("completed_at")},
                )
            )
        return events

    async def _auth_headers(
        self, method: str, path: str, kwargs: Dict[str, Any], requires_auth: bool
    ) -> Dict[str, str]:
        if not requires_auth:
            return {}
        credentials = self.api_keys.get_key(self.name)
        if not credentials:
            raise RuntimeError("Missing API credentials for Coinbase")
        timestamp = str(time.time())
        params = kwargs.get("params") or {}
        body = ""
        if "json" in kwargs and kwargs["json"] is not None:
            body = json.dumps(kwargs["json"], separators=(",", ":"))
        elif "data" in kwargs and kwargs["data"] is not None:
            body = kwargs["data"] if isinstance(kwargs["data"], str) else json.dumps(kwargs["data"], separators=(",", ":"))
        query = httpx.QueryParams(params).to_str()
        request_path = f"/{path.lstrip('/')}"
        if query:
            request_path = f"{request_path}?{query}"
        prehash = f"{timestamp}{method.upper()}{request_path}{body}"
        secret = base64.b64decode(credentials.secret)
        signature = hmac.new(secret, prehash.encode(), hashlib.sha256).digest()
        signature_b64 = base64.b64encode(signature).decode()
        headers = {
            "CB-ACCESS-KEY": credentials.key,
            "CB-ACCESS-SIGN": signature_b64,
            "CB-ACCESS-TIMESTAMP": timestamp,
        }
        if credentials.passphrase:
            headers["CB-ACCESS-PASSPHRASE"] = credentials.passphrase
        return headers
