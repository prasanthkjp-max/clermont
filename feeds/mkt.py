"""MKT Feed - Market data from CoinGecko and simulated market indices."""

import random
import time
from datetime import datetime, timezone

import httpx

from .base import BaseFeed, Event, Severity


class MarketFeed(BaseFeed):
    name = "MKT"

    async def _fetch_live(self) -> list[Event]:
        """Fetch market data from CoinGecko and generate market events."""
        events: list[Event] = []
        now = datetime.now(timezone.utc).isoformat()

        async with httpx.AsyncClient(timeout=15) as client:
            # CoinGe crypto prices
            try:
                resp = await client.get(
                    "https://api.coingecko.com/simple/price",
                    params={
                        "ids": "bitcoin,ethereum,solana,ripple,dogecoin",
                        "vs_currencies": "usd",
                        "include_24hr_change": "true",
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    name_map = {
                        "bitcoin": "BTC",
                        "ethereum": "ETH",
                        "solana": "SOL",
                        "ripple": "XRP",
                        "dogecoin": "DOGE",
                    }
                    for coin_id, prices in data.items():
                        symbol = name_map.get(coin_id, coin_id.upper())
                        price = prices.get("usd", 0)
                        change = prices.get("usd_24h_change", 0)

                        if change <= -10:
                            severity = Severity.CRITICAL
                        elif change <= -5:
                            severity = Severity.HIGH
                        elif abs(change) <= 2:
                            severity = Severity.LOW
                        elif change >= 10:
                            severity = Severity.HIGH
                        else:
                            severity = Severity.MEDIUM

                        direction = "▲" if change >= 0 else "▼"
                        title = f"{symbol} ${price:,.2f} {direction} {abs(change):.1f}% 24H"

                        events.append(Event(
                            id=f"mkt-crypto-{symbol.lower()}",
                            feed="MKT",
                            title=title,
                            severity=severity.value,
                            lat=None,
                            lng=None,
                            timestamp=now,
                            source="COINGECKO",
                            url=f"https://www.coingecko.com/en/coins/{coin_id}",
                        ))
            except Exception:
                pass

        # Simulated market index data (since Yahoo Finance requires auth/headers)
        indices = [
            ("S&P 500", 5234.18, "SPX"),
            ("NASDAQ", 16384.47, "IXIC"),
            ("DOW JONES", 38901.23, "DJI"),
            ("FTSE 100", 7654.12, "FTSE"),
            ("NIKKEI", 38256.44, "N225"),
        ]

        for name, base_price, symbol in indices:
            change_pct = round(random.uniform(-3.5, 3.5), 2)
            price = round(base_price * (1 + change_pct / 100), 2)

            if change_pct <= -2.0:
                severity = Severity.CRITICAL
            elif change_pct <= -1.0:
                severity = Severity.HIGH
            elif abs(change_pct) <= 0.5:
                severity = Severity.LOW
            elif change_pct >= 2.0:
                severity = Severity.HIGH
            else:
                severity = Severity.MEDIUM

            direction = "▲" if change_pct >= 0 else "▼"
            title = f"{name} {price:,.2f} {direction} {abs(change_pct):.2f}%"

            events.append(Event(
                id=f"mkt-idx-{symbol.lower()}",
                feed="MKT",
                title=title,
                severity=severity.value,
                lat=None,
                lng=None,
                timestamp=now,
                source="SIMULATED",
                url="",
            ))

        # VIX / volatility event
        vix_val = round(random.uniform(12, 35), 2)
        if vix_val > 30:
            vix_sev = Severity.CRITICAL
            vix_title = f"VIX {vix_val} — EXTREME VOLATILITY"
        elif vix_val > 20:
            vix_sev = Severity.HIGH
            vix_title = f"VIX {vix_val} — ELEVATED VOLATILITY"
        else:
            vix_sev = Severity.LOW
            vix_title = f"VIX {vix_val} — NORMAL CONDITIONS"

        events.append(Event(
            id="mkt-vix",
            feed="MKT",
            title=vix_title,
            severity=vix_sev.value,
            lat=41.0, lng=-74.0,
            timestamp=now,
            source="SIMULATED",
            url="",
        ))

        return events

    def _mock_data(self) -> list[Event]:
        now = datetime.now(timezone.utc).isoformat()
        return [
            Event("mkt-mock-001", "MKT", "BTC $67,432 ▲ 2.3% 24H",
                  "MEDIUM", None, None, now, "COINGECKO", "https://coingecko.com"),
            Event("mkt-mock-002", "MKT", "ETH $3,521 ▼ -1.2% 24H",
                  "MEDIUM", None, None, now, "COINGECKO", "https://coingecko.com"),
            Event("mkt-mock-003", "MKT", "S&P 500 5,234.18 ▲ 0.85%",
                  "LOW", 41.0, -74.0, now, "SIMULATED", ""),
            Event("mkt-mock-004", "MKT", "NASDAQ 16,384.47 ▼ -1.5%",
                  "HIGH", 37.8, -122.4, now, "SIMULATED", ""),
            Event("mkt-mock-005", "MKT", "VIX 28.4 — ELEVATED VOLATILITY",
                  "HIGH", 41.0, -74.0, now, "SIMULATED", ""),
            Event("mkt-mock-006", "MKT", "NIKKEI 38,256.44 ▲ 1.2%",
                  "LOW", 35.7, 139.7, now, "SIMULATED", ""),
            Event("mkt-mock-007", "MKT", "BTC $67,432 ▲ 2.3% 24H",
                  "MEDIUM", None, None, now, "COINGECKO", "https://coingecko.com"),
        ]