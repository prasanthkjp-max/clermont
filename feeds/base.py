"""Base feed class and Event data model for Clermont."""

import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional


class FeedName(str, Enum):
    GEO = "GEO"
    ENV = "ENV"
    MKT = "MKT"
    INF = "INF"


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class FeedState(str, Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    DEGRADED = "DEGRADED"


@dataclass
class Event:
    id: str
    feed: str  # GEO | ENV | MKT | INF
    title: str
    severity: str  # CRITICAL | HIGH | MEDIUM | LOW
    lat: Optional[float] = None
    lng: Optional[float] = None
    timestamp: str = ""
    source: str = ""
    url: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class FeedStatus:
    name: str
    state: str  # ONLINE | OFFLINE | DEGRADED
    last_fetch: float = 0.0
    event_count: int = 0
    error: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "state": self.state,
            "last_fetch": self.last_fetch,
            "event_count": self.event_count,
            "error": self.error,
        }


class BaseFeed:
    """Base class for all data feeds. Handles caching and fallback."""

    name: str = "BASE"
    cache_ttl: int = 300  # 5 minutes

    def __init__(self):
        self._cache: list[Event] = []
        self._cache_time: float = 0.0
        self._status: FeedStatus = FeedStatus(name=self.name, state=FeedState.OFFLINE)

    @property
    def status(self) -> FeedStatus:
        return self._status

    @property
    def events(self) -> list[Event]:
        return self._cache

    def is_cache_valid(self) -> bool:
        return (time.time() - self._cache_time) < self.cache_ttl

    async def fetch(self) -> list[Event]:
        """Fetch data from live API. Falls back to mock data on failure."""
        if self.is_cache_valid() and self._cache:
            return self._cache
        try:
            events = await self._fetch_live()
            if events:
                self._cache = events
                self._cache_time = time.time()
                self._status.state = FeedState.ONLINE
                self._status.last_fetch = time.time()
                self._status.event_count = len(events)
                self._status.error = ""
            else:
                # Empty but valid response
                self._cache = self._mock_data()
                self._cache_time = time.time()
                self._status.state = FeedState.DEGRADED
                self._status.last_fetch = time.time()
                self._status.event_count = len(self._cache)
                self._status.error = "Empty response, using mock data"
        except Exception as e:
            self._cache = self._mock_data()
            self._cache_time = time.time()
            self._status.state = FeedState.DEGRADED
            self._status.last_fetch = time.time()
            self._status.event_count = len(self._cache)
            self._status.error = str(e)
        return self._cache

    async def _fetch_live(self) -> list[Event]:
        """Override in subclass. Fetch from the real API."""
        raise NotImplementedError

    def _mock_data(self) -> list[Event]:
        """Override in subclass. Provide fallback data."""
        return []