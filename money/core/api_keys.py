"""API key management utilities."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional
import os
import threading


@dataclass(frozen=True)
class ApiKey:
    """Represents a single API credential pair."""

    key: str
    secret: str
    passphrase: Optional[str] = None


class ApiKeyStore:
    """Thread-safe in-memory credential store.

    API keys can be loaded from environment variables using the
    ``load_from_env`` helper. Keys are namespaced by exchange identifier
    allowing multi-exchange setups.
    """

    def __init__(self) -> None:
        self._keys: Dict[str, ApiKey] = {}
        self._lock = threading.RLock()

    def set_key(self, exchange: str, key: ApiKey) -> None:
        with self._lock:
            self._keys[exchange] = key

    def get_key(self, exchange: str) -> Optional[ApiKey]:
        with self._lock:
            return self._keys.get(exchange)

    def load_from_env(self, exchange: str, key_var: str, secret_var: str, passphrase_var: Optional[str] = None) -> None:
        """Load credentials from environment variables."""

        key = os.getenv(key_var)
        secret = os.getenv(secret_var)
        passphrase = os.getenv(passphrase_var) if passphrase_var else None
        if not key or not secret:
            raise KeyError(f"Missing API credentials for {exchange}: {key_var}/{secret_var}")
        self.set_key(exchange, ApiKey(key=key, secret=secret, passphrase=passphrase))

    def remove_key(self, exchange: str) -> None:
        with self._lock:
            self._keys.pop(exchange, None)

    def clear(self) -> None:
        with self._lock:
            self._keys.clear()
