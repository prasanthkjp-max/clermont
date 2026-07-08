"""ENV Feed - Natural disasters from USGS Earthquakes and NOAA NWS Alerts."""

import time
from datetime import datetime, timezone

import httpx

from .base import BaseFeed, Event, Severity


class EnvFeed(BaseFeed):
    name = "ENV"

    async def _fetch_live(self) -> list[Event]:
        """Fetch environmental events from USGS and NOAA."""
        events: list[Event] = []

        async with httpx.AsyncClient(timeout=15) as client:
            # USGS Earthquakes
            try:
                resp = await client.get(
                    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    features = data.get("features", [])
                    for i, feature in enumerate(features):
                        props = feature.get("properties", {})
                        geom = feature.get("geometry", {})
                        coords = geom.get("coordinates", [None, None, None])
                        mag = props.get("mag", 0)
                        place = props.get("place", "Unknown location")
                        ts = props.get("time")
                        if ts:
                            ts = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat()
                        else:
                            ts = datetime.now(timezone.utc).isoformat()

                        if mag >= 6.0:
                            severity = Severity.CRITICAL
                        elif mag >= 5.0:
                            severity = Severity.HIGH
                        elif mag >= 4.0:
                            severity = Severity.MEDIUM
                        else:
                            severity = Severity.LOW

                        events.append(Event(
                            id=f"env-eq-{i:03d}",
                            feed="ENV",
                            title=f"EARTHQUAKE M{mag} — {place}".upper()[:120],
                            severity=severity.value,
                            lat=coords[1] if len(coords) > 1 else None,
                            lng=coords[0] if len(coords) > 0 else None,
                            timestamp=ts,
                            source="USGS",
                            url=props.get("url", ""),
                        ))
            except Exception:
                pass

            # NOAA NWS Active Alerts
            try:
                resp = await client.get("https://api.weather.gov/alerts/active")
                if resp.status_code == 200:
                    data = resp.json()
                    features = data.get("features", [])
                    for i, feature in enumerate(features[:15]):
                        props = feature.get("properties", {})
                        event_type = props.get("event", "WEATHER ALERT")
                        area = props.get("areaDesc", "Unknown area")
                        severity_str = props.get("severity", "MINOR")
                        headline = props.get("headline", f"{event_type} — {area}")
                        ts = props.get("sent") or datetime.now(timezone.utc).isoformat()

                        if severity_str.upper() in ("EXTREME", "SEVERE"):
                            severity = Severity.CRITICAL
                        elif severity_str.upper() in ("MODERATE",):
                            severity = Severity.HIGH
                        elif severity_str.upper() in ("MINOR",):
                            severity = Severity.MEDIUM
                        else:
                            severity = Severity.LOW

                        events.append(Event(
                            id=f"env-nws-{i:03d}",
                            feed="ENV",
                            title=headline[:120].upper(),
                            severity=severity.value,
                            lat=None,
                            lng=None,
                            timestamp=ts,
                            source="NOAA/NWS",
                            url=props.get("uri", "") or props.get("url", ""),
                        ))
            except Exception:
                pass

        return events[:30]

    def _mock_data(self) -> list[Event]:
        now = datetime.now(timezone.utc).isoformat()
        return [
            Event("env-mock-001", "ENV", "EARTHQUAKE M6.2 — 45KM NW OF RABAUL, PNG",
                  "CRITICAL", -4.2, 152.5, now, "USGS", "https://earthquake.usgs.gov"),
            Event("env-mock-002", "ENV", "EARTHQUAKE M5.4 — OFF COAST OF CHILE",
                  "HIGH", -30.0, -71.5, now, "USGS", "https://earthquake.usgs.gov"),
            Event("env-mock-003", "ENV", "FLASH FLOOD WARNING — CENTRAL TEXAS",
                  "HIGH", 31.0, -97.5, now, "NOAA/NWS", "https://weather.gov"),
            Event("env-mock-004", "ENV", "TORNADO WARNING — SOUTHWEST OKLAHOMA",
                  "CRITICAL", 35.0, -98.5, now, "NOAA/NWS", "https://weather.gov"),
            Event("env-mock-005", "ENV", "EARTHQUAKE M4.8 — SOUTHERN CALIFORNIA",
                  "MEDIUM", 33.8, -118.2, now, "USGS", "https://earthquake.usgs.gov"),
            Event("env-mock-006", "ENV", "WINTER STORM WARNING — NORTHEAST US",
                  "MEDIUM", 42.4, -71.1, now, "NOAA/NWS", "https://weather.gov"),
            Event("env-mock-007", "ENV", "EARTHQUAKE M7.1 — NEAR EAST COAST OF HONSHU, JAPAN",
                  "CRITICAL", 38.3, 142.4, now, "USGS", "https://earthquake.usgs.gov"),
            Event("env-mock-008", "ENV", "VOLCANIC ERUPTION — KILAUEA, HAWAII",
                  "HIGH", 19.4, -155.3, now, "USGS", "https://volcanoes.usgs.gov"),
        ]