"""Iteration 9 tests: code generator, new data types, explain-code AI endpoint."""
import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- CODE generator preview ----------
class TestCodeGeneratorPreview:
    def test_python_code_generator_ok(self, client):
        code = (
            "import sys, random\n"
            "random.seed(int(sys.argv[1]))\n"
            "n = random.randint(1,5)\n"
            "print(n)\n"
            "print(*[random.randint(1,9) for _ in range(n)])\n"
        )
        r = client.post(f"{BASE_URL}/api/preview", json={
            "generator": {"mode": "code", "language": "python", "code": code}
        })
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True, data
        lines = data["input"].strip().splitlines()
        assert len(lines) == 2
        n = int(lines[0])
        vals = list(map(int, lines[1].split()))
        assert len(vals) == n and all(1 <= v <= 9 for v in vals)

    def test_python_crashing_generator_returns_traceback(self, client):
        code = "raise ValueError('boom-generator-fail')\n"
        r = client.post(f"{BASE_URL}/api/preview", json={
            "generator": {"mode": "code", "language": "python", "code": code}
        })
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is False
        err = (data.get("error") or "").lower()
        assert "boom-generator-fail" in err or "traceback" in err or "valueerror" in err, data

    def test_cpp_code_generator_ok(self, client):
        code = (
            "#include <bits/stdc++.h>\n"
            "using namespace std;\n"
            "int main(int argc, char** argv){\n"
            "  srand(atoi(argv[1]));\n"
            "  int n = 1 + rand()%5;\n"
            "  cout << n << '\\n';\n"
            "  for(int i=0;i<n;i++) cout << (1+rand()%9) << ' ';\n"
            "  cout << '\\n';\n"
            "  return 0;\n"
            "}\n"
        )
        r = client.post(f"{BASE_URL}/api/preview", json={
            "generator": {"mode": "code", "language": "cpp", "code": code}
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True, data
        lines = data["input"].strip().splitlines()
        assert len(lines) == 2
        n = int(lines[0])
        vals = list(map(int, lines[1].split()))
        assert len(vals) == n


# ---------- CODE end-to-end run: WA ----------
class TestCodeRunEndToEnd:
    def test_code_mode_finds_wa(self, client):
        gen_code = (
            "import sys, random\n"
            "random.seed(int(sys.argv[1]))\n"
            "n = random.randint(2,5)\n"
            "print(n)\n"
            "print(*[random.randint(1,9) for _ in range(n)])\n"
        )
        # buggy user: skips last element => sum of n-1
        user_py = (
            "n=int(input())\n"
            "a=list(map(int,input().split()))\n"
            "print(sum(a[:-1]))\n"
        )
        brute_py = (
            "n=int(input())\n"
            "a=list(map(int,input().split()))\n"
            "print(sum(a))\n"
        )
        payload = {
            "generator": {"mode": "code", "language": "python", "code": gen_code},
            "userCode": user_py, "userLang": "python",
            "bruteCode": brute_py, "bruteLang": "python",
            "numTests": 20,
            "timeLimitMs": 2000,
        }
        r = client.post(f"{BASE_URL}/api/run/start", json=payload)
        assert r.status_code == 200, r.text
        job_id = r.json()["jobId"]
        deadline = time.time() + 60
        status = None
        while time.time() < deadline:
            time.sleep(1.2)
            s = client.get(f"{BASE_URL}/api/run/status/{job_id}")
            assert s.status_code == 200
            status = s.json()
            if status.get("status") == "completed":
                break
        assert status and status.get("status") == "completed", status
        summary = status.get("summary") or {}
        assert summary.get("firstFail") is not None, status
        assert summary["counts"]["WA"] >= 1
        assert status["tests"][0]["verdict"] == "WA"


# ---------- Advanced/simple new data types ----------
class TestNewDataTypes:
    def test_advanced_chars_word_floats(self, client):
        tmpl = (
            "n = int(2, 4)\n"
            "print(n)\n"
            "chars(n, a-z)\n"
            "word(5, ABC)\n"
            "floats(n, 0, 1, 3)\n"
        )
        r = client.post(f"{BASE_URL}/api/preview", json={
            "generator": {"mode": "advanced", "template": tmpl}
        })
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True, data
        lines = data["input"].splitlines()
        # line0: n; line1: chars; line2: word; line3: floats
        assert len(lines) >= 4
        n = int(lines[0])
        chars_line = lines[1].replace(" ", "")
        assert len(chars_line) == n and re.fullmatch(r"[a-z]+", chars_line)
        word_line = lines[2]
        assert len(word_line) == 5 and re.fullmatch(r"[ABC]+", word_line)
        floats_tokens = lines[3].split()
        assert len(floats_tokens) == n
        for t in floats_tokens:
            assert "." in t
            dec = t.split(".")[1]
            assert len(dec) == 3, f"expected 3 decimals, got {t}"
            v = float(t)
            assert 0.0 <= v <= 1.0

    def test_simple_list_floats(self, client):
        text = "let n = 2..3\nprint n\nlist n floats in 0..10\n"
        r = client.post(f"{BASE_URL}/api/preview", json={
            "generator": {"mode": "simple", "text": text}
        })
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True, data
        lines = data["input"].splitlines()
        assert len(lines) >= 2
        n = int(lines[0])
        toks = lines[1].split()
        assert len(toks) == n
        for t in toks:
            assert "." in t
            v = float(t)
            assert 0.0 <= v <= 10.0


# ---------- Explain-code AI endpoint ----------
class TestExplainCode:
    def test_explain_code_structured(self, client):
        code = (
            "#include <bits/stdc++.h>\nusing namespace std;\n"
            "int main(){int n;cin>>n;long long s=0;"
            "for(int i=0;i<n;i++){int x;cin>>x;s+=x;}"
            "cout<<s;return 0;}\n"
        )
        r = client.post(f"{BASE_URL}/api/ai/explain-code", json={
            "language": "cpp",
            "problem": "sum of n integers",
            "code": code,
        }, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("approach"), str) and len(data["approach"]) > 0
        assert isinstance(data.get("steps"), list) and len(data["steps"]) > 0
        assert isinstance(data.get("complexity"), str) and len(data["complexity"]) > 0
        assert "edgeCases" in data
