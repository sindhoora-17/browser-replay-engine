from fastapi.testclient import TestClient
from cua.dashboard.api import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True

def test_capabilities_are_real_files():
    response = client.get("/api/capabilities")
    assert response.status_code == 200
    assert response.json()["items"]
    assert all("id" in item and "steps" in item for item in response.json()["items"])

def test_reject_unknown_capability():
    response = client.post("/api/replays", json={
        "capability_id": "../unknown.json", "member_id": "10001"
    })
    assert response.status_code == 404

def test_reject_invalid_member():
    response = client.post("/api/replays", json={
        "capability_id": "lookup_savings_balance.json",
        "member_id": "https://unsafe.example"
    })
    assert response.status_code == 422

def test_unknown_run():
    assert client.get("/api/runs/not-a-real-run").status_code == 404
