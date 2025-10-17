"""Generic blockchain data client for wallet event ingestion."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Callable

import httpx

from ..core import AlertManager
from ..models import WalletEvent, WalletEventType


@dataclass
class BlockchainEvent:
    address: str
    asset: str
    amount: float
    tx_hash: str
    block_number: int
    timestamp: datetime
    raw: Dict[str, Any]


class BlockchainClient:
    """Fetches blockchain data from third-party providers or self-hosted nodes."""

    def __init__(
        self,
        endpoint: str,
        alert_manager: Optional[AlertManager] = None,
        timeout: float = 10.0,
    ) -> None:
        self.endpoint = endpoint
        self.alerts = alert_manager or AlertManager()
        self._client = httpx.AsyncClient(base_url=endpoint, timeout=timeout)

    async def fetch_events(
        self, method: str, params: Optional[Dict[str, Any]] = None
    ) -> List[BlockchainEvent]:
        payload = {"method": method, "params": params or {}}
        response = await self._client.post("/", json=payload)
        response.raise_for_status()
        data = response.json()
        events = []
        for item in data.get("result", []):
            events.append(
                BlockchainEvent(
                    address=item.get("address"),
                    asset=item.get("asset"),
                    amount=float(item.get("amount", 0)),
                    tx_hash=item.get("tx_hash"),
                    block_number=int(item.get("block_number", 0)),
                    timestamp=datetime.fromtimestamp(
                        int(item.get("timestamp", 0)), tz=timezone.utc
                    ),
                    raw=item,
                )
            )
        return events

    async def to_wallet_events(self, events: Iterable[BlockchainEvent]) -> List[WalletEvent]:
        wallet_events: List[WalletEvent] = []
        for event in events:
            event_type = WalletEventType.DEPOSIT if event.amount >= 0 else WalletEventType.WITHDRAWAL
            wallet_events.append(
                WalletEvent(
                    exchange="on-chain",
                    asset=event.asset,
                    amount=event.amount,
                    event_type=event_type,
                    timestamp=event.timestamp,
                    tx_id=event.tx_hash,
                    metadata={"block_number": event.block_number, "address": event.address},
                )
            )
        return wallet_events

    async def monitor_wallet(
        self,
        method: str,
        params: Dict[str, Any],
        callback: Callable[[List[WalletEvent]], Any],
        interval: float = 15.0,
    ) -> None:
        """Continuously fetch and forward wallet events."""

        while True:
            try:
                events = await self.fetch_events(method, params)
                wallet_events = await self.to_wallet_events(events)
                await callback(wallet_events)
            except Exception as exc:  # pragma: no cover - defensive
                self.alerts.warning("Blockchain monitor error", {"error": str(exc)})
            await asyncio.sleep(interval)

    async def close(self) -> None:
        await self._client.aclose()
