"""Regression tests for widened bounds (no 422) and AC-test payload."""
import os
import time
import requests
from pathlib import Path
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


PY_SUM = "n=int(input())\na=list(map(int,input().split()))\nprint(sum(a))\n"

SIMPLE_GEN = {
    "mode": "simple",
    "variables": [{"name": "n", "type": "int", "min": "1", "max": "3"}],
    "lines": [
        {"kind": "vars", "vars": ["n"]},
        {"kind": "array", "type": "int", "count": "n", "min": "1", "max": "10"},
    ],
}


def _body(**over):
    b = {
        "userCode": PY_SUM, "userLang": "python",
        "bruteCode": PY_SUM, "bruteLang": "python",
        "generator": SIMPLE_GEN, "numTests": 3, "timeLimitMs": 2000,
        "memLimitMb": 256, "stopOnFirstFail": False, "seed": 1,
    }
    b.update(over)
    return b


# ---- Bounds: widened, no more 422 ----
def test_numtests_500_accepted(client):
    r = client.post(f"{API}/run/start", json=_body(numTests=500, timeLimitMs=1000))
    assert r.status_code == 200, r.text
    job_id = r.json()["jobId"]
    # cancel immediately to save resources
    client.post(f"{API}/run/cancel/{job_id}")


def test_numtests_5000_upper_ok(client):
    r = client.post(f"{API}/run/start", json=_body(numTests=5000))
    assert r.status_code == 200, r.text
    client.post(f"{API}/run/cancel/{r.json()['jobId']}")


def test_numtests_5001_rejected(client):
    r = client.post(f"{API}/run/start", json=_body(numTests=5001))
    assert r.status_code == 422


def test_timelimit_50_accepted(client):
    r = client.post(f"{API}/run/start", json=_body(timeLimitMs=50, numTests=1))
    assert r.status_code == 200, r.text
    # poll to completion (fast)
    job_id = r.json()["jobId"]
    for _ in range(60):
        d = client.get(f"{API}/run/status/{job_id}").json()
        if d["phase"] == "done":
            break
        time.sleep(0.3)


def test_timelimit_10_lower_bound(client):
    r = client.post(f"{API}/run/start", json=_body(timeLimitMs=10, numTests=1))
    assert r.status_code == 200, r.text


def test_timelimit_9_rejected(client):
    r = client.post(f"{API}/run/start", json=_body(timeLimitMs=9))
    assert r.status_code == 422


def test_memlimit_8_accepted(client):
    r = client.post(f"{API}/run/start", json=_body(memLimitMb=8, numTests=1))
    assert r.status_code == 200, r.text


def test_memlimit_4_lower_bound(client):
    r = client.post(f"{API}/run/start", json=_body(memLimitMb=4, numTests=1))
    assert r.status_code == 200, r.text


def test_memlimit_3_rejected(client):
    r = client.post(f"{API}/run/start", json=_body(memLimitMb=3))
    assert r.status_code == 422


# ---- AC test entries now carry input/expected/output ----
def _poll(client, job_id, timeout=60):
    t0 = time.time()
    while time.time() - t0 < timeout:
        d = client.get(f"{API}/run/status/{job_id}").json()
        if d["phase"] == "done":
            return d
        time.sleep(0.3)
    raise TimeoutError()


def test_ac_tests_include_io(client):
    r = client.post(f"{API}/run/start", json=_body(numTests=5, stopOnFirstFail=False))
    assert r.status_code == 200
    data = _poll(client, r.json()["jobId"])
    assert data["status"] == "completed"
    assert data["summary"]["counts"]["AC"] == 5
    ac_tests = [t for t in data["tests"] if t["verdict"] == "AC"]
    assert len(ac_tests) == 5
    for t in ac_tests:
        assert t.get("input"), "AC test missing input"
        assert "expected" in t and t["expected"] is not None
        assert "output" in t and t["output"] is not None
        # they should match for AC
        assert t["expected"].strip() == t["output"].strip()
