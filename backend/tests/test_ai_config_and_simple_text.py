"""Iteration 6 tests: AI config endpoints + Simple text template preview."""
import os
import time
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break
API = f"{BASE_URL}/api"

DEFAULT_MODEL = "openai/gpt-oss-120b"
ALT_MODEL = "llama-3.3-70b-versatile"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- AI config ----------
def test_ai_status_shape(client):
    r = client.get(f"{API}/ai/status", timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ("enabled", "model", "usingUserKey", "defaultAvailable"):
        assert k in d, d
    assert isinstance(d["enabled"], bool)
    assert isinstance(d["model"], str) and d["model"]
    assert isinstance(d["usingUserKey"], bool)
    assert isinstance(d["defaultAvailable"], bool)


def test_ai_config_invalid_key(client):
    r = client.post(f"{API}/ai/config", json={"apiKey": "gsk_bad_key_that_is_definitely_invalid_xxx"}, timeout=30)
    assert r.status_code == 400, r.text


def test_ai_config_switch_model_then_clear(client):
    # switch model only
    r = client.post(f"{API}/ai/config", json={"model": ALT_MODEL}, timeout=30)
    assert r.status_code == 200, r.text
    s = client.get(f"{API}/ai/status", timeout=20).json()
    assert s["model"] == ALT_MODEL, s

    # clear -> back to default
    r2 = client.post(f"{API}/ai/config", json={"clear": True}, timeout=30)
    assert r2.status_code == 200, r2.text
    s2 = client.get(f"{API}/ai/status", timeout=20).json()
    assert s2["model"] == DEFAULT_MODEL, s2
    assert s2["usingUserKey"] is False


# ---------- Simple text template preview ----------
def test_preview_simple_text_ok(client):
    payload = {
        "generator": {
            "mode": "simple",
            "text": "let n = 1..6\nprint n\nlist n ints in 1..20\nword 4 in a-z",
        },
        "seed": 5,
    }
    r = client.post(f"{API}/preview", json=payload, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d.get("ok") is True, d
    lines = d["input"].strip().splitlines()
    assert len(lines) == 3, lines
    n = int(lines[0])
    assert 1 <= n <= 6
    ints = lines[1].split()
    assert len(ints) == n
    for x in ints:
        v = int(x)
        assert 1 <= v <= 20
    w = lines[2]
    assert len(w) == 4 and w.isalpha() and w.islower()


def test_preview_simple_text_malformed(client):
    payload = {
        "generator": {
            "mode": "simple",
            "text": "let n = 1..6\nprint n\nlist n ints 1..20",  # missing 'in'
        },
        "seed": 1,
    }
    r = client.post(f"{API}/preview", json=payload, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d.get("ok") is False, d
    err = (d.get("error") or "").lower()
    assert "in" in err, err


def test_preview_advanced_graph_preset(client):
    tpl = "n = int(2, 8)\nm = int(1, n*(n-1)//2)\nprint(n, m)\ngrid(m, 2, 1, n)"
    r = client.post(f"{API}/preview", json={"generator": {"mode": "advanced", "template": tpl}, "seed": 7}, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d.get("ok") is True, d
    lines = d["input"].strip().splitlines()
    n_m = lines[0].split()
    assert len(n_m) == 2
    n, m = int(n_m[0]), int(n_m[1])
    assert 2 <= n <= 8
    assert len(lines) == 1 + m
