"""AIS vessel tracking feed for Clermont.

Connects to aisstream.io WebSocket API, maintains an in-memory store of
vessel positions, and exposes REST + SSE endpoints for the frontend.
"""

import asyncio
import json
import logging
import os
import time
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Optional

import websockets
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("clermont.ais")

router = APIRouter(prefix="/api/ais", tags=["ais"])

# ---------------------------------------------------------------------------
# In-memory vessel store
# ---------------------------------------------------------------------------

MAX_VESSELS = 50000


class VesselStore:
    """Ordered dict-based store keyed by MMSI; evicts oldest beyond MAX_VESSELS."""

    def __init__(self, max_vessels: int = MAX_VESSELS):
        self._store: OrderedDict[int, dict] = OrderedDict()
        self._max = max_vessels
        self._tracked: set[int] = set()
        self._lock = asyncio.Lock()

    async def upsert(self, mmsi: int, data: dict):
        async with self._lock:
            if mmsi in self._store:
                self._store.move_to_end(mmsi)
                self._store[mmsi].update(data)
            else:
                self._store[mmsi] = data
                self._store.move_to_end(mmsi)
            while len(self._store) > self._max:
                self._store.popitem(last=False)

    async def get(self, mmsi: int) -> Optional[dict]:
        async with self._lock:
            return self._store.get(mmsi)

    async def all_vessels(self) -> list[dict]:
        async with self._lock:
            return list(self._store.values())

    async def search(self, query: str) -> list[dict]:
        q = query.lower().strip()
        if not q:
            return []
        async with self._lock:
            results = []
            for v in self._store.values():
                if (
                    q in str(v.get("name", "")).lower()
                    or q in str(v.get("mmsi", "")).lower()
                    or q in str(v.get("imo", "")).lower()
                    or q in str(v.get("callsign", "")).lower()
                ):
                    results.append(v)
            return results

    async def count(self) -> int:
        async with self._lock:
            return len(self._store)

    # --- tracking (pin) ---
    async def track(self, mmsi: int):
        async with self._lock:
            self._tracked.add(mmsi)

    async def untrack(self, mmsi: int):
        async with self._lock:
            self._tracked.discard(mmsi)

    async def tracked_vessels(self) -> list[dict]:
        async with self._lock:
            return [self._store[m] for m in self._tracked if m in self._store]

    def is_tracked(self, mmsi: int) -> bool:
        return mmsi in self._tracked


store = VesselStore()

# ---------------------------------------------------------------------------
# Feed status
# ---------------------------------------------------------------------------

class AISFeed:
    STATE_OFFLINE = "OFFLINE"
    STATE_DEGRADED = "DEGRADED"
    STATE_ONLINE = "ONLINE"

    def __init__(self):
        self.state = self.STATE_OFFLINE
        self.last_message_time: float = 0.0
        self.message_count: int = 0
        self.reconnect_attempts: int = 0
        self._task: Optional[asyncio.Task] = None

    def to_dict(self) -> dict:
        return {
            "state": self.state,
            "vessel_count": 0,
            "last_message_time": self.last_message_time,
            "message_count": self.message_count,
            "reconnect_attempts": self.reconnect_attempts,
        }

    async def status_dict(self) -> dict:
        return {
            "state": self.state,
            "vessel_count": await store.count(),
            "tracked_count": len(store._tracked),
            "last_message_time": self.last_message_time,
            "message_count": self.message_count,
            "reconnect_attempts": self.reconnect_attempts,
        }


feed = AISFeed()

# ---------------------------------------------------------------------------
# SSE subscriber management
# ---------------------------------------------------------------------------

class SSEManager:
    def __init__(self):
        self._queues: list[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._queues.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self._queues:
            self._queues.remove(q)

    async def broadcast(self, data: dict):
        dead = []
        for q in self._queues:
            try:
                q.put_nowait(data)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self.unsubscribe(q)


sse = SSEManager()

# ---------------------------------------------------------------------------
# AIS WebSocket client
# ---------------------------------------------------------------------------

AIS_WS_URL = "wss://stream.aisstream.io/v0/stream"


def _parse_ais_message(raw_data) -> Optional[dict]:
    """Extract vessel data from an aisstream.io message.

    Messages arrive as BINARY frames containing JSON with keys:
    Message, MessageType, MetaData
    """
    try:
        # Messages come as bytes (binary WebSocket frames)
        if isinstance(raw_data, (bytes, bytearray)):
            raw_data = raw_data.decode('utf-8')
        message = json.loads(raw_data)

        msg_type = message.get("MessageType", "")
        meta = message.get("MetaData", {})
        inner = message.get("Message", {})

        if msg_type == "PositionReport":
            pr = inner.get("PositionReport", {})
            if not pr:
                return None

            mmsi = meta.get("MMSI") or pr.get("UserID")
            if not mmsi:
                return None

            lat = pr.get("Latitude")
            lng = pr.get("Longitude")
            if lat is None or lng is None:
                return None

            sog = pr.get("Sog")  # knots
            cog = pr.get("Cog")  # degrees
            heading = pr.get("TrueHeading")
            if heading == 511:
                heading = None
            nav_status = pr.get("NavigationalStatus")

            name = meta.get("ShipName", "")
            if name:
                name = name.strip()

            return {
                "mmsi": int(mmsi),
                "name": name or "",
                "lat": float(lat),
                "lng": float(lng),
                "sog": float(sog) if sog is not None else None,
                "cog": float(cog) if cog is not None else None,
                "heading": float(heading) if heading is not None else None,
                "nav_status": int(nav_status) if nav_status is not None else None,
                "timestamp": meta.get("time_utc") or datetime.now(timezone.utc).isoformat(),
                "destination": "",
                "eta": "",
                "ship_type": "",
                "imo": "",
                "callsign": "",
            }

        elif msg_type in ("ShipData", "StaticData"):
            sd = inner.get("ShipData", inner.get("StaticData", inner))
            mmsi = meta.get("MMSI") or sd.get("UserID")
            if not mmsi:
                return None

            name = meta.get("ShipName", "") or sd.get("ShipName", "")
            if name:
                name = name.strip()

            return {
                "mmsi": int(mmsi),
                "name": name or "",
                "lat": None,
                "lng": None,
                "sog": None,
                "cog": None,
                "heading": None,
                "nav_status": None,
                "timestamp": meta.get("time_utc") or datetime.now(timezone.utc).isoformat(),
                "destination": sd.get("Destination", "") or "",
                "eta": str(sd.get("Eta", "")) if sd.get("Eta") else "",
                "ship_type": str(sd.get("ShipType", "")) if sd.get("ShipType") else "",
                "imo": str(sd.get("ImoNumber", "")) if sd.get("ImoNumber") else "",
                "callsign": str(sd.get("CallSign", "")) if sd.get("CallSign") else "",
                "_partial": True,  # merge with existing vessel data
            }

        return None
    except Exception as e:
        logger.debug("Error parsing AIS message: %s", e)
        return None


async def _ais_ws_loop():
    """Main WebSocket loop with exponential backoff reconnection."""
    api_key = os.environ.get("AIS_API_KEY", "")
    backoff = 1

    while True:
        if not api_key:
            feed.state = AISFeed.STATE_OFFLINE
            logger.info("AIS_API_KEY not set — feed stays OFFLINE")
            await asyncio.sleep(30)
            continue

        try:
            feed.reconnect_attempts += 1
            subscribe_msg = {
                "APIKey": api_key,
                "BoundingBoxes": [[[-90, -180], [90, 180]]],
            }

            async with websockets.connect(
                AIS_WS_URL,
                ping_interval=30,
                ping_timeout=60,
                close_timeout=10,
            ) as ws:
                await ws.send(json.dumps(subscribe_msg))
                feed.state = AISFeed.STATE_ONLINE
                feed.reconnect_attempts = 0
                backoff = 1
                logger.info("AIS WebSocket connected")

                async for raw in ws:
                    try:
                        parsed = _parse_ais_message(raw)
                        if parsed:
                            mmsi = parsed["mmsi"]
                            # Handle partial updates (ShipData messages)
                            if parsed.get("_partial"):
                                existing = await store.get(mmsi)
                                if existing:
                                    # Merge: update only non-None fields
                                    for k, v in parsed.items():
                                        if k == "_partial":
                                            continue
                                        if v is not None and v != "":
                                            existing[k] = v
                                    await store.upsert(mmsi, existing)
                                    # Broadcast merged vessel
                                    await sse.broadcast(existing)
                                else:
                                    # Store as-is, will be enriched by PositionReport later
                                    parsed.pop("_partial", None)
                                    await store.upsert(mmsi, parsed)
                                    await sse.broadcast(parsed)
                            else:
                                # Full PositionReport — upsert and broadcast
                                await store.upsert(mmsi, parsed)
                                feed.last_message_time = time.time()
                                feed.message_count += 1
                                await sse.broadcast(parsed)
                    except Exception as e:
                        logger.debug("Error processing AIS message: %s", e)

        except asyncio.CancelledError:
            logger.info("AIS WebSocket task cancelled")
            feed.state = AISFeed.STATE_OFFLINE
            raise
        except Exception as e:
            logger.warning("AIS WebSocket error: %s — retrying in %ds", e, backoff)
            feed.state = AISFeed.STATE_DEGRADED
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


_task: Optional[asyncio.Task] = None


async def start_ais_feed():
    """Start the AIS WebSocket background task."""
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_ais_ws_loop())
        logger.info("AIS WebSocket background task started")
    return _task


def stop_ais_feed():
    global _task
    if _task and not _task.done():
        _task.cancel()
    _task = None


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/vessels")
async def list_vessels(search: Optional[str] = None, page: int = 1, limit: int = 100):
    if search:
        vessels = await store.search(search)
    else:
        vessels = await store.all_vessels()
    total = len(vessels)
    start = (page - 1) * limit
    end = start + limit
    return JSONResponse({
        "vessels": vessels[start:end],
        "total": total,
        "page": page,
        "limit": limit,
    })


@router.get("/vessels/light")
async def list_vessels_light():
    """Lightweight endpoint: only MMSI, name, lat, lng, heading, sog, timestamp.
    Used for map marker rendering to minimize data transfer."""
    vessels = await store.all_vessels()
    light = []
    for v in vessels:
        light.append({
            "m": v.get("mmsi"),
            "n": v.get("name", ""),
            "la": v.get("lat"),
            "lo": v.get("lng"),
            "h": v.get("heading"),
            "s": v.get("sog"),
        })
    return JSONResponse({"v": light, "c": len(light)})


@router.get("/vessels/{mmsi}")
async def get_vessel(mmsi: int):
    v = await store.get(mmsi)
    if v is None:
        raise HTTPException(status_code=404, detail=f"Vessel {mmsi} not found")
    return JSONResponse(v)


@router.get("/tracked")
async def get_tracked():
    vessels = await store.tracked_vessels()
    return JSONResponse({"vessels": vessels, "count": len(vessels)})


@router.post("/track/{mmsi}")
async def track_vessel(mmsi: int):
    await store.track(mmsi)
    v = await store.get(mmsi)
    return JSONResponse({"mmsi": mmsi, "tracked": True, "vessel": v})


@router.delete("/track/{mmsi}")
async def untrack_vessel(mmsi: int):
    await store.untrack(mmsi)
    return JSONResponse({"mmsi": mmsi, "tracked": False})


@router.get("/status")
async def ais_status():
    return JSONResponse(await feed.status_dict())


# ---------------------------------------------------------------------------
# SSE stream
# ---------------------------------------------------------------------------

@router.get("/stream")
async def ais_stream(request: Request):
    q = sse.subscribe()
    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive comment
                    yield ": keepalive\n\n"
        finally:
            sse.unsubscribe(q)

    return StreamingResponse(
        event_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )