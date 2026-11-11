"""Local-only dashboard API for existing Browser Replay Engine capabilities.

Start with: uvicorn cua.dashboard.api:app --host 127.0.0.1 --port 8000
The API only accepts capability names discovered in ./capabilities. It never accepts
arbitrary artifact paths, URLs, selectors or scripts from the client.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from cua.artifact.store import load_artifact
from cua.replay.engine import ReplayEngine
from cua.surface.web import PlaywrightSurface

ROOT = Path(__file__).resolve().parents[2]
CAPABILITIES = ROOT / "capabilities"
EVIDENCE = ROOT / "evidence" / "replay"
app = FastAPI(title="Replay Mochi API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
_runs: dict[str, dict] = {}
_tasks: set[asyncio.Task] = set()
_lock = asyncio.Lock()


def available_capabilities() -> dict[str, Path]:
    paths = sorted(CAPABILITIES.glob("*.json")) + sorted(
        (CAPABILITIES / "generated").glob("*.json")
    )
    return {str(path.relative_to(CAPABILITIES)): path for path in paths}


def replay_events(run_id: str) -> list[dict]:
    """Read existing engine JSONL logs; do not expose sensitive input/output fields."""
    log = EVIDENCE / run_id / "run.jsonl"
    if not log.is_file():
        return []
    events = []
    for line in log.read_text(encoding="utf-8").splitlines():
        try:
            entry = json.loads(line)
            events.append({
                "event": entry.get("event", "event"),
                "step_id": entry.get("step_id"),
                "action": entry.get("action"),
                "intent": entry.get("intent"),
                "reason": entry.get("reason"),
                "timestamp": entry.get("timestamp"),
            })
        except (ValueError, TypeError):
            continue
    return events


class ReplayRequest(BaseModel):
    capability_id: str
    member_id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    allow_draft: bool = False


@app.get("/api/health")
def health():
    return {"ok": True, "mode": "local", "engine": "playwright"}


@app.get("/api/capabilities")
def capabilities():
    items = []
    for name, path in available_capabilities().items():
        try:
            artifact = load_artifact(path)
            items.append({
                "id": name,
                "name": artifact.capability.name,
                "description": artifact.capability.description,
                "approval_state": artifact.capability.approval_state.value,
                "steps": len(artifact.steps),
                "target": artifact.target.app_id,
            })
        except (ValueError, OSError):
            continue
    return {"items": items}


@app.get("/api/runs")
def runs():
    return {"items": list(reversed(list(_runs.values())))}


@app.get("/api/runs/{request_id}")
def run_details(request_id: str):
    if request_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = dict(_runs[request_id])
    if run.get("engine_run_id"):
        run["events"] = replay_events(run["engine_run_id"])
    return run


async def _execute(request_id: str, path: Path, member_id: str, allow_draft: bool):
    surface = PlaywrightSurface(headless=True)
    record = _runs[request_id]
    try:
        artifact = load_artifact(path)
        await surface.start()
        result = await ReplayEngine(
            surface, allow_draft=allow_draft, evidence_dir=EVIDENCE
        ).run(artifact, {"member_id": member_id})
        record["status"] = result.status.value
        record["outcome_code"] = result.outcome_code
        record["error"] = result.error.model_dump() if result.error else None
        # Outputs can contain sensitive values and are intentionally not sent to the UI.
        record["finished_at"] = datetime.now(timezone.utc).isoformat()
        # Engine logs use their own IDs; find the fresh log from this execution below.
    except Exception as exc:
        record["status"] = "failure"
        record["error"] = {"code": "DASHBOARD_RUN_ERROR", "message": str(exc)}
        record["finished_at"] = datetime.now(timezone.utc).isoformat()
    finally:
        if getattr(surface, "browser", None) is not None:
            await surface.close()


@app.post("/api/replays", status_code=202)
async def start_replay(body: ReplayRequest):
    path = available_capabilities().get(body.capability_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Unknown capability")
    artifact = load_artifact(path)
    if "member_id" not in artifact.inputs:
        raise HTTPException(status_code=400, detail="This capability does not accept member_id")
    if artifact.capability.approval_state.value != "approved" and not body.allow_draft:
        raise HTTPException(status_code=400, detail="Draft capability requires explicit allow_draft")
    async with _lock:
        if any(r["status"] == "running" for r in _runs.values()):
            raise HTTPException(status_code=409, detail="A replay is already running")
        request_id = "ui_" + uuid4().hex[:10]
        _runs[request_id] = {
            "id": request_id,
            "capability_id": body.capability_id,
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": None,
            "error": None,
            "outcome_code": None,
            "events": [],
        }
        task = asyncio.create_task(_execute(request_id, path, body.member_id, body.allow_draft))
        _tasks.add(task)
        task.add_done_callback(_tasks.discard)
    return {"id": request_id, "status": "running"}
