"""Alerting primitives for operational visibility."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Optional


class AlertLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class Alert:
    level: AlertLevel
    message: str
    context: Optional[dict] = None


class AlertManager:
    """Simple alert dispatcher with pluggable sink."""

    def __init__(self, sink: Optional[Callable[[Alert], None]] = None) -> None:
        self._sink = sink or self._default_sink
        self._logger = logging.getLogger("money.alerts")

    def emit(self, level: AlertLevel, message: str, context: Optional[dict] = None) -> None:
        self._sink(Alert(level=level, message=message, context=context))

    def info(self, message: str, context: Optional[dict] = None) -> None:
        self.emit(AlertLevel.INFO, message, context)

    def warning(self, message: str, context: Optional[dict] = None) -> None:
        self.emit(AlertLevel.WARNING, message, context)

    def critical(self, message: str, context: Optional[dict] = None) -> None:
        self.emit(AlertLevel.CRITICAL, message, context)

    def _default_sink(self, alert: Alert) -> None:
        log_method = {
            AlertLevel.INFO: self._logger.info,
            AlertLevel.WARNING: self._logger.warning,
            AlertLevel.CRITICAL: self._logger.critical,
        }[alert.level]
        log_method("%s | context=%s", alert.message, alert.context)
