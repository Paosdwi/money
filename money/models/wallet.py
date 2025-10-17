"""Wallet event models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator
from typing import Optional


class WalletEventType(str, Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    TRANSFER = "transfer"
    TRADE_FEE = "trade_fee"
    REWARD = "reward"


class WalletEvent(BaseModel):
    exchange: str = Field(..., min_length=1)
    asset: str = Field(..., min_length=1)
    amount: float
    event_type: WalletEventType
    timestamp: datetime
    tx_id: Optional[str]
    metadata: dict = Field(default_factory=dict)

    @validator("amount")
    def validate_amount(cls, value: float) -> float:
        if value == 0:
            raise ValueError("amount cannot be zero")
        return value
