"""OKX exchange connector."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any, Dict, List

import httpx

from .base import ExchangeConnector
from ..core import AlertManager, ApiKeyStore, AsyncRateLimiter
from ..models import OrderBookLevel, OrderBookSnapshot, PricePoint, VolumePoint, WalletEvent, WalletEventType


class OkxConnector(ExchangeConnector):
    def __init__(
        self,
        api_keys: ApiKeyStore,
        rate_limiter: AsyncRateLimiter | None = None,
        alert_manager: AlertManager | None = None,
    ) -> None:
        super().__init__(
            name="okx",
            rest_base="https://www.okx.com",
            ws_base="wss://ws.okx.com:8443/ws/v5/public",
            api_keys=api_keys,
            rate_limiter=rate_limiter,
            alert_manager=alert_manager,
        )

    async def fetch_price(self, instrument_id: str) -> PricePoint:
        data = await self.get_json("api/v5/market/ticker", params={"instId": instrument_id})
        ticker = data["data"][0]
        return PricePoint(
            exchange=self.name,
            symbol=instrument_id,
            price=float(ticker["last"]),
            timestamp=datetime.now(timezone.utc),
            source="rest",
        )

    async def fetch_volume(self, instrument_id: str) -> VolumePoint:
        data = await self.get_json("api/v5/market/ticker", params={"instId": instrument_id})
        ticker = data["data"][0]
        return VolumePoint(
            exchange=self.name,
            symbol=instrument_id,
            base_volume=float(ticker["vol24h"]),
            quote_volume=float(ticker.get("volCcy24h", 0.0)),
            timestamp=datetime.now(timezone.utc),
        )

    async def fetch_order_book(self, instrument_id: str, depth: int = 50) -> OrderBookSnapshot:
        data = await self.get_json(
            "api/v5/market/books",
            params={"instId": instrument_id, "sz": depth},
        )
        book = data["data"][0]
        bids = [OrderBookLevel(price=float(price), size=float(size)) for price, size, *_ in book["bids"]]
        asks = [OrderBookLevel(price=float(price), size=float(size)) for price, size, *_ in book["asks"]]
        ts = datetime.fromtimestamp(int(book["ts"]) / 1000, tz=timezone.utc)
        return OrderBookSnapshot(
            exchange=self.name,
            symbol=instrument_id,
            bids=bids,
            asks=asks,
            timestamp=ts,
        )

    async def fetch_wallet_events(self) -> List[WalletEvent]:
        response = await self.get_json(
            "api/v5/account/bills", params={"type": "1"}, requires_auth=True
        )
        events: List[WalletEvent] = []
        for entry in response.get("data", []):
            event_type = WalletEventType.DEPOSIT if float(entry["balChg"]) >= 0 else WalletEventType.WITHDRAWAL
            amount = float(entry["balChg"])
            timestamp = datetime.fromtimestamp(int(entry["ts"]) / 1000, tz=timezone.utc)
            events.append(
                WalletEvent(
                    exchange=self.name,
                    asset=entry["ccy"],
                    amount=amount,
                    event_type=event_type,
                    timestamp=timestamp,
                    tx_id=entry.get("billId"),
                    metadata={"type": entry.get("type"), "subType": entry.get("subType")},
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
            raise RuntimeError("Missing API credentials for OKX")
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
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
            "OK-ACCESS-KEY": credentials.key,
            "OK-ACCESS-SIGN": signature_b64,
            "OK-ACCESS-TIMESTAMP": timestamp,
        }
        if credentials.passphrase:
            headers["OK-ACCESS-PASSPHRASE"] = credentials.passphrase
        return headers
