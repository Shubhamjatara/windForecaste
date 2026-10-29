"""Store successful upstream responses locally until their cache lifetime ends."""

import json
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, NamedTuple


class CachedResponse(NamedTuple):
    records: list[dict[str, Any]]
    fetched_at: datetime


class ResponseCache:
    """A small persistent cache shared across backend restarts."""

    def __init__(self, path: Path, ttl_seconds: int = 3600) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.ttl = timedelta(seconds=ttl_seconds)

        with sqlite3.connect(self.path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS responses (
                    key TEXT PRIMARY KEY,
                    fetched_at TEXT NOT NULL,
                    payload TEXT NOT NULL
                )
                """
            )

    def get(self, key: str) -> CachedResponse | None:
        """Return a fresh response, or None when it is absent, expired or corrupt."""
        with sqlite3.connect(self.path) as connection:
            row = connection.execute(
                "SELECT fetched_at, payload FROM responses WHERE key = ?",
                (key,),
            ).fetchone()

        if row is None:
            return None

        fetched_at_text, payload_text = row
        fetched_at = datetime.fromisoformat(fetched_at_text)
        cache_age = datetime.now(UTC) - fetched_at
        if cache_age > self.ttl:
            # Expired data must trigger retrieval, even if the upstream API is down.
            return None

        try:
            records = json.loads(payload_text)
        except json.JSONDecodeError:
            return None

        return CachedResponse(records=records, fetched_at=fetched_at)

    def put(
        self, key: str, payload: list[dict[str, Any]], fetched_at: datetime
    ) -> None:
        """Replace a response atomically using SQLite's transaction context."""
        # Reject NaN and infinity so cached JSON always contains valid numbers.
        payload_text = json.dumps(payload, allow_nan=False)
        with sqlite3.connect(self.path) as connection:
            connection.execute(
                "INSERT OR REPLACE INTO responses (key, fetched_at, payload) "
                "VALUES (?, ?, ?)",
                (key, fetched_at.isoformat(), payload_text),
            )
