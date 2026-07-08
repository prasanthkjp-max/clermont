"""Clermont — World Situation Monitor.

FastAPI server serving live geopolitical, environmental, market, and news events
with an 80s amber terminal dashboard frontend.
"""

import asyncio
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from feeds import Event, GeoFeed, EnvFeed, MarketFeed, InfoFeed
from feeds.ais import router as ais_router, start_ais_feed, stop_ais_feed

app = FastAPI(title="Clermont — World Situation Monitor", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
PUBLIC_DIR = Path(__file__).parent / "public"

# Feed instances
feeds = {
    "GEO": GeoFeed(),
    "ENV": EnvFeed(),
    "MKT": MarketFeed(),
    "INF": InfoFeed(),
}


@app.on_event("startup")
async def startup_event():
    """Pre-fetch all feeds and start AIS WebSocket on startup."""
    tasks = [feed.fetch() for feed in feeds.values()]
    await asyncio.gather(*tasks, return_exceptions=True)
    # Start AIS WebSocket background task
    await start_ais_feed()


@app.get("/api/events")
async def get_events(feed: Optional[str] = None):
    """Get all events, optionally filtered by feed."""
    all_events: list[dict] = []
    if feed and feed.upper() in feeds:
        events = await feeds[feed.upper()].fetch()
        all_events = [e.to_dict() for e in events]
    else:
        for f in feeds.values():
            events = await f.fetch()
            all_events.extend(e.to_dict() for e in events)
    # Sort by timestamp descending
    all_events.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return JSONResponse(all_events)


@app.get("/api/events/{feed}")
async def get_events_by_feed(feed: str):
    """Get events for a specific feed."""
    feed = feed.upper()
    if feed not in feeds:
        raise HTTPException(status_code=404, detail=f"Feed '{feed}' not found. Available: {list(feeds.keys())}")
    events = await feeds[feed].fetch()
    return JSONResponse([e.to_dict() for e in events])


@app.get("/api/feeds/status")
async def get_feeds_status():
    """Get status of all feeds."""
    # Trigger a fetch if cache is stale
    for f in feeds.values():
        if not f.is_cache_valid():
            asyncio.create_task(f.fetch())
    return JSONResponse({
        "feeds": [f.status.to_dict() for f in feeds.values()],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_events": sum(f.status.event_count for f in feeds.values()),
    })


@app.get("/api/health")
async def health():
    return {"status": "OK", "time": datetime.now(timezone.utc).isoformat()}


# Serve static frontend
@app.get("/")
async def index():
    return FileResponse(PUBLIC_DIR / "index.html")


# AIS feed endpoints
app.include_router(ais_router)

# Mount static files for CSS, JS, data
app.mount("/css", StaticFiles(directory=PUBLIC_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=PUBLIC_DIR / "js"), name="js")
app.mount("/data", StaticFiles(directory=PUBLIC_DIR / "data"), name="data")


@app.on_event("shutdown")
async def shutdown_event():
    """Stop AIS WebSocket on shutdown."""
    stop_ais_feed()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8009)