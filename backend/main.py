"""
FastAPI server with WebSocket support.
Streams scanner progress and results to the Next.js frontend.
"""

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Set

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from scanner import TIMEFRAME, MA_FAST, MA_SLOW, OVERSOLD, OVERBOUGHT, run_scan

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SCAN_INTERVAL = int(os.getenv("SCAN_INTERVAL", 60))

# ── Global state ──────────────────────────────────────────────────────────────
connected_clients: Set[WebSocket] = set()
latest_signals:   list[dict]      = []
scan_status = {
    "running":   False,
    "progress":  0,
    "total":     0,
    "current_symbol": "",
    "last_scan": None,
    "signal_count": 0,
}


# ── Broadcast helpers ─────────────────────────────────────────────────────────
async def broadcast(message: dict):
    dead = set()
    for ws in connected_clients:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


async def progress_cb(current: int, total: int, symbol: str):
    scan_status.update({"progress": current, "total": total, "current_symbol": symbol})
    await broadcast({
        "type":    "progress",
        "current": current,
        "total":   total,
        "symbol":  symbol,
        "pct":     round(current / total * 100, 1),
    })


# ── Background scanner loop ───────────────────────────────────────────────────
async def scanner_loop():
    from datetime import datetime, timezone

    while True:
        scan_status["running"]        = True
        scan_status["progress"]       = 0
        scan_status["total"]          = 0
        scan_status["current_symbol"] = ""
        await broadcast({"type": "scan_start"})

        try:
            signals = await run_scan(progress_cb=progress_cb)
            global latest_signals
            latest_signals = signals

            scan_status.update({
                "running":      False,
                "last_scan":    datetime.now(timezone.utc).isoformat(),
                "signal_count": len(signals),
            })

            await broadcast({
                "type":    "scan_complete",
                "signals": signals,
                "count":   len(signals),
            })

        except Exception as e:
            logger.error("Scanner error: %s", e)
            scan_status["running"] = False
            await broadcast({"type": "error", "message": str(e)})

        await asyncio.sleep(SCAN_INTERVAL)


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(scanner_loop())
    yield
    task.cancel()


app = FastAPI(title="Crypto Futures Scanner", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST endpoints ────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "ok", "message": "Crypto Futures Scanner API"}


@app.get("/status")
async def status():
    return {
        **scan_status,
        "config": {
            "timeframe":  TIMEFRAME,
            "ma_fast":    MA_FAST,
            "ma_slow":    MA_SLOW,
            "oversold":   OVERSOLD,
            "overbought": OVERBOUGHT,
            "interval":   SCAN_INTERVAL,
        },
    }


@app.get("/signals")
async def get_signals():
    return {
        "signals":   latest_signals,
        "count":     len(latest_signals),
        "last_scan": scan_status["last_scan"],
    }


@app.post("/scan/trigger")
async def trigger_scan():
    """Manually trigger a scan (non-blocking – fires a background task)."""
    if scan_status["running"]:
        return {"message": "Scan already running"}

    async def one_shot():
        from datetime import datetime, timezone
        scan_status["running"]        = True
        scan_status["progress"]       = 0
        scan_status["total"]          = 0
        scan_status["current_symbol"] = ""
        await broadcast({"type": "scan_start"})
        try:
            signals = await run_scan(progress_cb=progress_cb)
            global latest_signals
            latest_signals = signals
            scan_status.update({
                "running":      False,
                "last_scan":    datetime.now(timezone.utc).isoformat(),
                "signal_count": len(signals),
            })
            await broadcast({"type": "scan_complete", "signals": signals, "count": len(signals)})
        except Exception as e:
            scan_status["running"] = False
            await broadcast({"type": "error", "message": str(e)})

    asyncio.create_task(one_shot())
    return {"message": "Scan triggered"}


# ── WebSocket endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    logger.info("WS client connected. Total: %d", len(connected_clients))

    # Send current state immediately on connect
    await websocket.send_text(json.dumps({
        "type":    "init",
        "status":  scan_status,
        "signals": latest_signals,
    }))

    try:
        while True:
            # Keep connection alive; client can send ping
            data = await websocket.receive_text()
            msg  = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        logger.info("WS client disconnected. Total: %d", len(connected_clients))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=False,
    )
