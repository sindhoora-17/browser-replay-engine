# Replay Mochi — pastel browser replay dashboard

A React + Vite frontend connected to the existing Browser Replay Engine through a **local-only** FastAPI adapter. This is a development interface, not a production-hosted multi-user service.

## Local setup

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]" httpx
python -m playwright install chromium
```

In **terminal 1**, start the synthetic application (the dashboard's saved capability targets this app):

```bash
TARGET_APP_BYPASS_AUTH=true python -m target_app.server
```

In **terminal 2**, start the new backend API:

```bash
source .venv/bin/activate
uvicorn cua.dashboard.api:app --host 127.0.0.1 --port 8000
```

In **terminal 3**, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The header should display **API connected**. Go to **Capabilities** or **Start real replay**, select `generated/lookup_savings_balance.json`, leave the test member ID as `10001` and allow the draft artifact only for the local demo. View the real engine run in **Replay Runs**; JSONL trace events appear as execution progresses.

## Important limitations

- This API deliberately binds to loopback only in the documented command; do not expose it to the public internet. It has no authentication.
- The backend accepts only capability IDs already found in `capabilities/`; it does not accept arbitrary URLs or browser scripts. Python engine policy checks remain authoritative.
- The API keeps run records only for the life of its Python process. Underlying evidence is stored in `evidence/replay/`.
- The frontend intentionally does not expose potentially sensitive replay output values.
- Replay health percentages on the Overview page are marked as illustrative. Run counts and statuses come from real executions.
- Discovery/recording, pause and cancellation controls are **not** implemented; this frontend triggers existing deterministic replay capabilities.

## Checks

```bash
cd frontend && npm run build && npm run test
cd .. && pytest -q tests/test_dashboard_api.py
```

CI also starts the synthetic application and runs a headless Chromium replay integration test.
