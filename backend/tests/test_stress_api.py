"""Backend API tests for CP Stress Tester."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend .env when running standalone
    from pathlib import Path
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


SIMPLE_GEN = {
    "mode": "simple",
    "variables": [{"name": "n", "min": "1", "max": "5"}],
    "lines": [
        {"kind": "vars", "vars": ["n"]},
        {"kind": "array", "count": "n", "min": "1", "max": "100"},
    ],
}

ADV_TEMPLATE = """n = int(1, 5)
print(n)
array(n, 1, 100)
"""

# ---- Health / meta ----
def test_root(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    assert "message" in r.json()


def test_languages(client):
    r = client.get(f"{API}/languages")
    assert r.status_code == 200
    ids = {x["id"] for x in r.json()}
    assert {"python", "cpp", "java"}.issubset(ids)


# ---- Preview ----
def test_preview_simple(client):
    r = client.post(f"{API}/preview", json={"generator": SIMPLE_GEN, "seed": 1})
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["input"].strip() != ""


def test_preview_advanced(client):
    r = client.post(f"{API}/preview", json={"generator": {"mode": "advanced", "template": ADV_TEMPLATE}, "seed": 2})
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert len(data["input"].strip().splitlines()) >= 2


def test_preview_gen_error(client):
    bad = {"mode": "advanced", "template": "n = int(10, 1)\nprint(n)"}
    r = client.post(f"{API}/preview", json={"generator": bad})
    assert r.status_code == 200
    assert r.json()["ok"] is False


# ---- Stress run: WA (C++ off-by-one sum) ----
USER_CPP_WA = r"""
#include <bits/stdc++.h>
using namespace std;
int main(){
    int n; if(!(cin>>n)) return 0;
    long long s=0; int x;
    for(int i=0;i<n-1;i++){ cin>>x; s+=x; } // bug
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


def test_run_cpp_wa(client):
    r = client.post(f"{API}/run", json={
        "userCode": USER_CPP_WA, "userLang": "cpp",
        "bruteCode": BRUTE_CPP, "bruteLang": "cpp",
        "generator": SIMPLE_GEN, "numTests": 20, "timeLimitMs": 2000,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 42,
    }, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "completed"
    assert data["summary"]["firstFail"] is not None
    assert data["summary"]["counts"]["WA"] >= 1


PY_SUM = "n=int(input())\na=list(map(int,input().split()))\nprint(sum(a))\n"


def test_run_python_ac(client):
    r = client.post(f"{API}/run", json={
        "userCode": PY_SUM, "userLang": "python",
        "bruteCode": PY_SUM, "bruteLang": "python",
        "generator": SIMPLE_GEN, "numTests": 10, "timeLimitMs": 3000,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 1,
    }, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "completed", data
    assert data["summary"]["firstFail"] is None
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


def test_run_java_ac(client):
    r = client.post(f"{API}/run", json={
        "userCode": JAVA_SUM, "userLang": "java",
        "bruteCode": JAVA_SUM, "bruteLang": "java",
        "generator": SIMPLE_GEN, "numTests": 5, "timeLimitMs": 5000,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 3,
    }, timeout=180)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "completed", data
    assert data["summary"]["firstFail"] is None
    assert data["summary"]["counts"]["AC"] == data["summary"]["total"]


# ---- CE ----
def test_run_ce_cpp(client):
    bad = "int main(){ this is not valid cpp"
    r = client.post(f"{API}/run", json={
        "userCode": bad, "userLang": "cpp",
        "bruteCode": BRUTE_CPP, "bruteLang": "cpp",
        "generator": SIMPLE_GEN, "numTests": 5, "timeLimitMs": 2000,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 1,
    }, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "CE"
    assert data["ce"]["target"] == "user"


# ---- TLE ----
TLE_CPP = r"""
#include <bits/stdc++.h>
using namespace std;
int main(){ while(true){} return 0; }
"""


def test_run_tle(client):
    r = client.post(f"{API}/run", json={
        "userCode": TLE_CPP, "userLang": "cpp",
        "bruteCode": BRUTE_CPP, "bruteLang": "cpp",
        "generator": SIMPLE_GEN, "numTests": 3, "timeLimitMs": 300,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 1,
    }, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "completed"
    assert data["summary"]["counts"]["TLE"] >= 1


# ---- RTE (division by zero) ----
RTE_CPP = r"""
#include <bits/stdc++.h>
using namespace std;
int main(){ int n; cin>>n; int z=0; cout<<(n/z); return 0; }
"""


def test_run_rte(client):
    r = client.post(f"{API}/run", json={
        "userCode": RTE_CPP, "userLang": "cpp",
        "bruteCode": BRUTE_CPP, "bruteLang": "cpp",
        "generator": SIMPLE_GEN, "numTests": 3, "timeLimitMs": 2000,
        "memLimitMb": 256, "stopOnFirstFail": True, "seed": 1,
    }, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "completed"
    assert data["summary"]["counts"]["RTE"] >= 1


# ---- MLE ----
MLE_CPP = r"""
#include <bits/stdc++.h>
using namespace std;
int main(){
    // Allocate ~200 MB
    vector<char> v;
    v.assign(200LL*1024*1024, 'x');
    // touch memory
    for(size_t i=0;i<v.size();i+=4096) v[i]=(char)i;
    cout<<v.size()<<endl;
    return 0;
}
"""


def test_run_mle(client):
    r = client.post(f"{API}/run", json={
        "userCode": MLE_CPP, "userLang": "cpp",
        "bruteCode": BRUTE_CPP, "bruteLang": "cpp",
        "generator": SIMPLE_GEN, "numTests": 3, "timeLimitMs": 5000,
        "memLimitMb": 32, "stopOnFirstFail": True, "seed": 1,
    }, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "completed"
    assert data["summary"]["counts"]["MLE"] >= 1
