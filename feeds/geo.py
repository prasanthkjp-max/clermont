"""GEO Feed - Geopolitical events from GDELT Project API."""

import time
from datetime import datetime, timezone

import httpx

from .base import BaseFeed, Event, Severity


class GeoFeed(BaseFeed):
    name = "GEO"

    async def _fetch_live(self) -> list[Event]:
        """Fetch geopolitical events from GDELT DOC API."""
        events: list[Event] = []
        queries = [
            ("military OR conflict OR troops OR sanctions", Severity.HIGH),
            ("war OR strike OR attack OR bombing", Severity.CRITICAL),
            ("summit OR treaty OR negotiation OR diplomacy", Severity.MEDIUM),
            ("election OR protest OR unrest OR coup", Severity.HIGH),
        ]

        async with httpx.AsyncClient(timeout=15) as client:
            for query, severity in queries:
                try:
                    url = "https://api.gdeltproject.org/api/v2/doc/doc"
                    params = {
                        "query": query,
                        "format": "json",
                        "maxrecords": 10,
                        "sort": "datedesc",
                    }
                    resp = await client.get(url, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                        articles = data.get("articles", [])
                        for i, article in enumerate(articles):
                            lat, lng = self._extract_coords(article)
                            ts = article.get("seendate", "")
                            try:
                                if ts:
                                    dt = datetime.strptime(ts, "%Y%m%dT%H%M%SZ")
                                    ts = dt.isoformat() + "Z"
                            except (ValueError, TypeError):
                                ts = datetime.now(timezone.utc).isoformat()

                            events.append(Event(
                                id=f"geo-{len(events):03d}",
                                feed="GEO",
                                title=article.get("title", "Unknown event")[:120].upper(),
                                severity=severity.value,
                                lat=lat,
                                lng=lng,
                                timestamp=ts,
                                source=article.get("domain", "GDELT"),
                                url=article.get("url", ""),
                            ))
                except Exception:
                    continue

        return events[:30]

    def _extract_coords(self, article: dict) -> tuple:
        """Extract lat/lng from GDELT article social image coords or return None."""
        try:
            # GDELT sometimes includes location in the article
            lat = article.get("socialimagecoords_lat")
            lng = article.get("socialimagecoords_lon")
            if lat and lng:
                return float(lat), float(lng)
        except (ValueError, TypeError):
            pass
        return None, None

    def _mock_data(self) -> list[Event]:
        now = datetime.now(timezone.utc).isoformat()
        return [
            Event("geo-mock-001", "GEO", "MILITARY BUILDUP REPORTED — EASTERN BORDER",
                  "CRITICAL", 49.8, 36.2, now, "AP/REUTERS", "https://example.com"),
            Event("geo-mock-002", "GEO", "SANCTIONS IMPOSED — TRADE RESTRICTIONS EXPANDED",
                  "HIGH", 39.9, 116.4, now, "BLOOMBERG", "https://example.com"),
            Event("geo-mock-003", "GEO", "DIPLOMATIC SUMMIT SCHEDULED — PEACE TALKS",
                  "MEDIUM", 41.9, 12.5, now, "REUTERS", "https://example.com"),
            Event("geo-mock-004", "GEO", "ELECTIONS ANNOUNCED — TRANSITION GOVERNMENT",
                  "MEDIUM", -1.3, 36.8, now, "AP", "https://example.com"),
            Event("geo-mock-005", "GEO", "PROTESTS CONTINUE — CAPITAL CITY",
                  "HIGH", 30.0, 31.2, now, "AL JAZEERA", "https://example.com"),
            Event("geo-mock-006", "GEO", "NAVAL EXERCISES — SOUTH CHINA SEA",
                  "HIGH", 15.0, 115.0, now, "REUTERS", "https://example.com"),
            Event("geo-mock-007", "GEO", "TREATY SIGNING — ARMS REDUCTION AGREEMENT",
                  "LOW", 55.7, 37.6, now, "TASS", "https://example.com"),
            Event("geo-mock-008", "GEO", "BORDER TENSIONS — MILITARY ALERT",
                  "CRITICAL", 34.0, 74.0, now, "AP", "https://example.com"),
        ]