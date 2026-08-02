"""Tests for AI endpoints powered by Groq."""
import os
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

SUM_PROBLEM = (
    "Given n on line 1 and n integers on line 2, print their sum. "
    "Constraints: 1<=n<=1000, values up to 1e9."
)


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _post_retry(client, url, json, attempts=2, timeout=60):
    last = None
    for _ in range(attempts):
        r = client.post(url, json=json, timeout=timeout)
        last = r
        if r.status_code < 500:
            return r
    return last


# ---- AI status ----
def test_ai_status(client):
    r = client.get(f"{API}/ai/status", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["enabled"] is True
    assert isinstance(data.get("model"), str) and len(data["model"]) > 0


# ---- Generate solution ----
@pytest.mark.parametrize("lang", ["cpp", "python", "java"])
def test_ai_generate_solution(client, lang):
    r = _post_retry(client, f"{API}/ai/generate-solution",
                    {"problem": SUM_PROBLEM, "language": lang}, attempts=2, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["language"] == lang
    assert isinstance(data["code"], str) and len(data["code"]) > 20
    assert isinstance(data.get("explanation", ""), str)
    if lang == "cpp":
        assert "int main" in data["code"]
    if lang == "python":
        # some solution keyword
        assert "input" in data["code"] or "sys.stdin" in data["code"]
    if lang == "java":
        assert "class Main" in data["code"]


# ---- Generate generator + validate via /preview ----
def test_ai_generate_generator_and_preview(client):
    r = _post_retry(client, f"{API}/ai/generate-generator",
                    {"problem": SUM_PROBLEM}, attempts=2, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("mode") == "advanced"
    template = data["template"]
    assert isinstance(template, str) and len(template.strip()) > 0

    # Validate template by hitting /preview
    pr = client.post(f"{API}/preview",
                     json={"generator": {"mode": "advanced", "template": template}, "seed": 3},
                     timeout=30)
    assert pr.status_code == 200
    pdata = pr.json()
    assert pdata.get("ok") is True, pdata
    assert isinstance(pdata.get("input"), str) and len(pdata["input"].strip()) > 0


# ---- Explain off-by-one bug ----
BUG_CPP = r"""
#include <bits/stdc++.h>
using namespace std;
int main(){
    int n; cin>>n;
    long long s=0; int x;
    for(int i=0;i<n-1;i++){ cin>>x; s+=x; }
    cout<<s<<endl;
}
"""


def test_ai_explain_off_by_one(client):
    payload = {
        "problem": SUM_PROBLEM,
        "language": "cpp",
        "code": BUG_CPP,
        "input": "3\n5 4 19",
        "expected": "28",
        "output": "9",
    }
    r = _post_retry(client, f"{API}/ai/explain", payload, attempts=2, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    diag = (data.get("diagnosis") or "").lower()
    hint = (data.get("hint") or "").lower()
    assert diag and hint
    combined = diag + " " + hint
    # should mention off-by-one / last element / n-1
    keywords = ["off-by-one", "off by one", "last", "n-1", "n - 1", "missing", "iteration", "loop"]
    assert any(k in combined for k in keywords), combined
