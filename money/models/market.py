"""Market data models with validation."""
from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field, validator
from typing import Literal, List


class PricePoint(BaseModel):
    exchange: str = Field(..., min_length=1)
    symbol: str = Field(..., min_length=1)
    price: float = Field(..., gt=0)
    timestamp: datetime
    source: Literal["rest", "websocket"]


class VolumePoint(BaseModel):
    exchange: str = Field(..., min_length=1)
    symbol: str = Field(..., min_length=1)
    base_volume: float = Field(..., ge=0)
    quote_volume: float = Field(..., ge=0)
    timestamp: datetime


class OrderBookLevel(BaseModel):
    price: float = Field(..., gt=0)
    size: float = Field(..., ge=0)


class OrderBookSnapshot(BaseModel):
    exchange: str = Field(..., min_length=1)
    symbol: str = Field(..., min_length=1)
    bids: List[OrderBookLevel]
    asks: List[OrderBookLevel]
    timestamp: datetime

    @validator("bids", "asks")
    def sort_levels(cls, value: List[OrderBookLevel], field):  # type: ignore[override]
        reverse = field.name == "bids"
        return sorted(value, key=lambda level: level.price, reverse=reverse)
