"""INF Feed - Global news from GDELT and RSS feeds."""

import time
from datetime import datetime, timezone

import httpx

from .base import BaseFeed, Event, Severity


class InfoFeed(BaseFeed):
    name = "INF"

    async def _fetch_live(self) -> list[Event]:
        """Fetch global news headlines from GDELT and RSS feeds."""
        events: list[Event] = []

        async with httpx.AsyncClient(timeout=15) as client:
            # GDELT for global news headlines
            try:
                url = "https://api.gdeltproject.org/api/v2/doc/doc"
                params = {
                    "query": "breaking news OR crisis OR emergency OR disaster",
                    "format": "json",
                    "maxrecords": 20,
                    "sort": "datedesc",
                }
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    articles = data.get("articles", [])
                    for i, article in enumerate(articles):
                        title = article.get("title", "Unknown news")
                        lang = article.get("language", "")
                        ts = article.get("seendate", "")
                        try:
                            if ts:
                                dt = datetime.strptime(ts, "%Y%m%dT%H%M%SZ")
                                ts = dt.isoformat() + "Z"
                        except (ValueError, TypeError):
                            ts = datetime.now(timezone.utc).isoformat()

                        # Determine severity from keywords
                        title_lower = title.lower()
                        if any(w in title_lower for w in ["killed", "dead", "explosion", "attack", "crash", "collapse"]):
                            severity = Severity.CRITICAL
                        elif any(w in title_lower for w in ["emergency", "evacuat", "warning", "threat", "strike"]):
                            severity = Severity.HIGH
                        elif any(w in title_lower for w in ["protest", "election", "summit", "market", "talks"]):
                            severity = Severity.MEDIUM
                        else:
                            severity = Severity.LOW

                        events.append(Event(
                            id=f"inf-gdelt-{i:03d}",
                            feed="INF",
                            title=title[:120].upper(),
                            severity=severity.value,
                            lat=None,
                            lng=None,
                            timestamp=ts,
                            source=article.get("domain", "GDELT"),
                            url=article.get("url", ""),
                        ))
            except Exception:
                pass

            # RSS feeds via rss2json
            rss_feeds = [
                ("https://feeds.reuters.com/reuters/topNews", "REUTERS"),
                ("https://feeds.ap.org/ap/rss/200", "AP"),
            ]
            for rss_url, source_name in rss_feeds:
                try:
                    resp = await client.get(
                        "https://api.rss2json.com/v1/api.json",
                        params={"rss_url": rss_url},
                        timeout=10,
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        items = data.get("items", [])
                        for i, item in enumerate(items[:8]):
                            title = item.get("title", "")
                            pub_date = item.get("pubDate", "")
                            try:
                                if pub_date:
                                    dt = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %Z")
                                    ts = dt.isoformat()
                                else:
                                    ts = datetime.now(timezone.utc).isoformat()
                            except (ValueError, TypeError):
                                ts = datetime.now(timezone.utc).isoformat()

                            title_lower = title.lower()
                            if any(w in title_lower for w in ["killed", "dead", "explosion", "attack"]):
                                severity = Severity.CRITICAL
                            elif any(w in title_lower for w in ["emergency", "warning", "crisis"]):
                                severity = Severity.HIGH
                            else:
                                severity = Severity.MEDIUM

                            events.append(Event(
                                id=f"inf-{source_name.lower()}-{i:03d}",
                                feed="INF",
                                title=title[:120].upper(),
                                severity=severity.value,
                                lat=None,
                                lng=None,
                                timestamp=ts,
                                source=source_name,
                                url=item.get("link", ""),
                            ))
                except Exception:
                    continue

        return events[:30]

    def _mock_data(self) -> list[Event]:
        now = datetime.now(timezone.utc).isoformat()
        return [
            Event("inf-mock-001", "INF", "BREAKING: MAJOR DEVELOPMENT IN ONGOING CONFLICT",
                  "CRITICAL", None, None, now, "REUTERS", "https://reuters.com"),
            Event("inf-mock-002", "INF", "EMERGENCY DECLARED AFTER SEVERE WEATHER EVENT",
                  "HIGH", None, None, now, "AP", "https://apnews.com"),
            Event("inf-mock-003", "INF", "WORLD LEADERS GATHER FOR CLIMATE SUMMIT",
                  "MEDIUM", None, None, now, "BBC", "https://bbc.com"),
            Event("inf-mock-004", "INF", "MARKETS RALLY ON POLICY ANNOUNCEMENT",
                  "LOW", None, None, now, "BLOOMBERG", "https://bloomberg.com"),
            Event("inf-mock-005", "INF", "HUMANITARIAN CRISIS DEEPENS IN REGION",
                  "HIGH", None, None, now, "AL JAZEERA", "https://aljazeera.com"),
            Event("inf-mock-006", "INF", "TECHNOLOGY BREAKTHROUGH ANNOUNCED",
                  "LOW", None, None, now, "TECHCRUNCH", "https://techcrunch.com"),
            Event("inf-mock-007", "INF", "DIPLOMATIC RELATIONS RESTORED AFTER TALKS",
                  "MEDIUM", None, None, now, "REUTERS", "https://reuters.com"),
            Event("inf-mock-008", "INF", "MAJOR EARTHQUAKE TRIGGERS TSUNAMI WARNING",
                  "CRITICAL", None, None, now, "AP", "https://apnews.com"),
        ]