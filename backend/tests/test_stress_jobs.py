"""Tests for NEW job-based endpoints + typed generator features."""
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


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Typed vars in Simple generator ----------------
def test_preview_typed_mixed(client):
    gen = {
        "mode": "simple",
        "variables": [
            {"name": "n", "type": "int", "min": "2", "max": "2"},
            {"name": "f", "type": "float", "min": "1.0", "max": "2.0", "decimals": 3},
            {"name": "c", "type": "char", "charset": "A-Z"},
            {"name": "s", "type": "string", "charset": "a-z", "len": "5"},
        ],
        "lines": [
            {"kind": "vars", "vars": ["n", "f", "c", "s"]},
        ],
    }
    r = client.post(f"{API}/preview", json={"generator": gen, "seed": 7})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True, data
    parts = data["input"].strip().split()
    assert len(parts) == 4
    assert parts[0] == "2"
    # float with 3 decimals
    assert "." in parts[1]
    frac = parts[1].split(".")[1]
    assert len(frac) == 3
    fv = float(parts[1])
    assert 1.0 <= fv <= 2.0
    # char from A-Z
    assert len(parts[2]) == 1 and parts[2].isupper()
    # string length 5, lowercase
    assert len(parts[3]) == 5 and parts[3].isalpha() and parts[3].islower()


def test_preview_distinct_array_ok(client):
    gen = {
        "mode": "simple",
        "variables": [{"name": "n", "type": "int", "min": "10", "max": "10"}],
        "lines": [
            {"kind": "vars", "vars": ["n"]},
            {"kind": "array", "type": "int", "count": "n", "min": "1", "max": "20", "distinct": True},
        ],
    }
    r = client.post(f"{API}/preview", json={"generator": gen, "seed": 5})
    data = r.json()
    assert data["ok"] is True
    arr = data["input"].strip().splitlines()[1].split()
    assert len(arr) == 10
    assert len(set(arr)) == 10  # all unique


def test_preview_distinct_too_large(client):
    gen = {
        "mode": "simple",
        "variables": [{"name": "n", "type": "int", "min": "10", "max": "10"}],
        "lines": [
            {"kind": "vars", "vars": ["n"]},
            {"kind": "array", "type": "int", "count": "n", "min": "1", "max": "5", "distinct": True},
        ],
    }
    r = client.post(f"{API}/preview", json={"generator": gen, "seed": 5})
    data = r.json()
    assert data["ok"] is False
    assert "distinct" in data["error"].lower() or "range" in data["error"].lower()


# ---------------- Job endpoints ----------------
SIMPLE_GEN = {
    "mode": "simple",
    "variables": [{"name": "n", "type": "int", "min": "1", "max": "5"}],
    "lines": [
        {"kind": "vars", "vars": ["n"]},
        {"kind": "array", "type": "int", "count": "n", "min": "1", "max": "100"},
    ],
}

PY_SUM = "n=int(input())\na=list(map(int,input().split()))\nprint(sum(a))\n"

USER_CPP_WA = r"""
#include <bits/stdc++.h>
using namespace std;
int main(){
    int n; if(!(cin>>n)) return 0;
    long long s=0; int x;
    for(int i=0;i<n-1;i++){ cin>>x; s+=x; }
    cout<<s<<endl;
}
"""
BRUTE_CPP = r"""
#include <bits/stdc++.h>
using namespace std;
int main(){
    int n; if(!(cin>>n)) return 0;
    long long s=0; int x;
    for(int i=0;i<n;i++){ cin>>x; s+=x; }
    cout<<s<<endl;
}
"""


def _poll(client, job_id, timeout=90):
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = client.get(f"{API}/run/status/{job_id}")
        assert r.status_code == 200
        data = r.json()
        if data["phase"] == "done" or data["status"] in ("completed", "cancelled", "CE", "GEN_ERROR", "error"):
            return data
        time.sleep(0.3)
    raise TimeoutError(f"Job {job_id} did not finish in {timeout}s")


def test_job_cpp_wa_flow(client):
    r = client.post(f"{API}/run/start", json={
        "userCode": USER_CPP_WA, "userLang": "cpp",
        "bruteCode": BRUTE_CPP, "bruteLang": "cpp",
        "generator": SIMPLE_GEN, "numTests": 20, "timeLimitMs": 2000,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 42,
    })
    assert r.status_code == 200
    job_id = r.json()["jobId"]
    data = _poll(client, job_id)
    assert data["status"] == "completed"
    assert data["summary"]["firstFail"] is not None
    assert data["summary"]["counts"]["WA"] >= 1
    # failing test entry has input/expected/output
    fail = next(t for t in data["tests"] if t["verdict"] == "WA")
    assert "input" in fail and "expected" in fail and "output" in fail


def test_job_py_ac(client):
    r = client.post(f"{API}/run/start", json={
        "userCode": PY_SUM, "userLang": "python",
        "bruteCode": PY_SUM, "bruteLang": "python",
        "generator": SIMPLE_GEN, "numTests": 8, "timeLimitMs": 3000,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 1,
    })
    job_id = r.json()["jobId"]
    data = _poll(client, job_id)
    assert data["status"] == "completed"
    assert data["summary"]["counts"]["AC"] == data["summary"]["total"]


JAVA_SUM = r"""
import java.util.*;
public class Main {
    public static void main(String[] args){
        Scanner sc=new Scanner(System.in);
        int n=sc.nextInt();
        long s=0;
        for(int i=0;i<n;i++) s+=sc.nextLong();
        System.out.println(s);
    }
}
"""


def test_job_java_ac(client):
    r = client.post(f"{API}/run/start", json={
        "userCode": JAVA_SUM, "userLang": "java",
        "bruteCode": JAVA_SUM, "bruteLang": "java",
        "generator": SIMPLE_GEN, "numTests": 4, "timeLimitMs": 5000,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 3,
    })
    job_id = r.json()["jobId"]
    data = _poll(client, job_id, timeout=120)
    assert data["status"] == "completed"
    assert data["summary"]["counts"]["AC"] == data["summary"]["total"]


def test_job_ce(client):
    r = client.post(f"{API}/run/start", json={
        "userCode": "int main(){ syntax error", "userLang": "cpp",
        "bruteCode": BRUTE_CPP, "bruteLang": "cpp",
        "generator": SIMPLE_GEN, "numTests": 3, "timeLimitMs": 2000,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 1,
    })
    job_id = r.json()["jobId"]
    data = _poll(client, job_id)
    assert data["status"] == "CE"
    assert data["ce"]["target"] == "user"


TLE_CPP = r"""
#include <bits/stdc++.h>
using namespace std;
int main(){ while(true){} return 0; }
"""


def test_job_tle(client):
    r = client.post(f"{API}/run/start", json={
        "userCode": TLE_CPP, "userLang": "cpp",
        "bruteCode": BRUTE_CPP, "bruteLang": "cpp",
        "generator": SIMPLE_GEN, "numTests": 3, "timeLimitMs": 300,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 1,
    })
    job_id = r.json()["jobId"]
    data = _poll(client, job_id)
    assert data["status"] == "completed"
    assert data["summary"]["counts"]["TLE"] >= 1


RTE_CPP = r"""
#include <bits/stdc++.h>
using namespace std;
int main(){ int n; cin>>n; int z=0; cout<<(n/z); return 0; }
"""


def test_job_rte(client):
    r = client.post(f"{API}/run/start", json={
        "userCode": RTE_CPP, "userLang": "cpp",
        "bruteCode": BRUTE_CPP, "bruteLang": "cpp",
        "generator": SIMPLE_GEN, "numTests": 3, "timeLimitMs": 2000,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 1,
    })
    job_id = r.json()["jobId"]
    data = _poll(client, job_id)
    assert data["status"] == "completed"
    assert data["summary"]["counts"]["RTE"] >= 1


MLE_CPP = r"""
#include <bits/stdc++.h>
using namespace std;
int main(){
    vector<char> v;
    v.assign(200LL*1024*1024, 'x');
    for(size_t i=0;i<v.size();i+=4096) v[i]=(char)i;
    cout<<v.size()<<endl;
    return 0;
}
"""


def test_job_mle(client):
    r = client.post(f"{API}/run/start", json={
        "userCode": MLE_CPP, "userLang": "cpp",
        "bruteCode": BRUTE_CPP, "bruteLang": "cpp",
        "generator": SIMPLE_GEN, "numTests": 3, "timeLimitMs": 5000,
        "memLimitMb": 32, "stopOnFirstFail": True, "seed": 1,
    })
    job_id = r.json()["jobId"]
    data = _poll(client, job_id)
    assert data["status"] == "completed"
    assert data["summary"]["counts"]["MLE"] >= 1


# ---------------- Streaming + progress ----------------
PY_SLEEP = """import sys, time
n=int(input())
a=list(map(int,input().split()))
time.sleep(0.15)
print(sum(a))
"""


def test_job_streaming_progress(client):
    r = client.post(f"{API}/run/start", json={
        "userCode": PY_SLEEP, "userLang": "python",
        "bruteCode": PY_SLEEP, "bruteLang": "python",
        "generator": SIMPLE_GEN, "numTests": 30, "timeLimitMs": 3000,
        "memLimitMb": 256, "stopOnFirstFail": False, "seed": 9,
    })
    job_id = r.json()["jobId"]

    phases_seen = set()
    done_progression = []
    tests_progression = []
    t0 = time.time()
    while time.time() - t0 < 90:
        d = client.get(f"{API}/run/status/{job_id}").json()
        phases_seen.add(d["phase"])
        done_progression.append(d["done"])
        tests_progression.append(len(d["tests"]))
        if d["phase"] == "done":
            break
        time.sleep(0.3)

    # phase transitioned through compiling/running
    assert "running" in phases_seen
    # done incremented over time
    assert max(done_progression) > min(done_progression)
    # tests streamed in (saw a partial state before completion)
    assert any(0 < x < 30 for x in tests_progression), tests_progression


# ---------------- Cancel ----------------
def test_job_cancel(client):
    r = client.post(f"{API}/run/start", json={
        "userCode": PY_SLEEP, "userLang": "python",
        "bruteCode": PY_SLEEP, "bruteLang": "python",
        "generator": SIMPLE_GEN, "numTests": 50, "timeLimitMs": 3000,
        "memLimitMb": 256, "stopOnFirstFail": False, "seed": 11,
    })
    job_id = r.json()["jobId"]
    # wait until running has produced at least 1 result
    t0 = time.time()
    while time.time() - t0 < 20:
        d = client.get(f"{API}/run/status/{job_id}").json()
        if d["phase"] == "running" and d["done"] >= 1:
            break
        time.sleep(0.3)
    cr = client.post(f"{API}/run/cancel/{job_id}")
    assert cr.status_code == 200
    data = _poll(client, job_id, timeout=30)
    assert data["status"] == "cancelled"
    assert data["done"] < 50


def test_cancel_unknown_job(client):
    r = client.post(f"{API}/run/cancel/does-not-exist")
    assert r.status_code == 404


def test_status_unknown_job(client):
    r = client.get(f"{API}/run/status/does-not-exist")
    assert r.status_code == 404
