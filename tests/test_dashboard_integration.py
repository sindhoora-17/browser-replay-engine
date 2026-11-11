"""Live local synthetic-app -> API -> Playwright replay integration check."""
import os
import subprocess
import sys
import time
from urllib.request import urlopen

from fastapi.testclient import TestClient

from cua.dashboard.api import app


def test_real_replay_on_synthetic_target():
    env = dict(os.environ)
    env["TARGET_APP_BYPASS_AUTH"] = "true"
    process = subprocess.Popen(
        [sys.executable, "-c",
         "from target_app.server import app; app.run(host='127.0.0.1',port=5000,debug=False)"],
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
    )
    try:
        for _ in range(50):
            try:
                with urlopen("http://127.0.0.1:5000/content/search", timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(0.2)
        else:
            raise AssertionError("Synthetic target app did not start")

        with TestClient(app) as client:
            started = client.post("/api/replays", json={
                "capability_id": "generated/lookup_savings_balance.json",
                "member_id": "10001",
                "allow_draft": True,
            })
            assert started.status_code == 202, started.text
            request_id = started.json()["id"]
            for _ in range(120):
                response = client.get(f"/api/runs/{request_id}")
                assert response.status_code == 200
                run = response.json()
                if run["status"] != "running":
                    break
                time.sleep(0.25)
            else:
                raise AssertionError("Replay did not finish in 30 seconds")
            assert run["status"] == "success", run
            assert run["engine_run_id"].startswith("replay_")
            assert any(event["event"] == "step_started" for event in run["events"])
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
