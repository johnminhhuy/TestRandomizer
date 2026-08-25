from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import ast
import json
import random
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

MAX_STORE = 8000  # max chars stored per test io for display

# ----------------------------- Groq (AI) client -----------------------------
from openai import OpenAI  # noqa: E402

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
AI_CONFIG_FILE = ROOT_DIR / ".ai_config.json"
_runtime_ai = {"api_key": None, "model": None}


def _load_ai_config():
    try:
        if AI_CONFIG_FILE.exists():
            data = json.loads(AI_CONFIG_FILE.read_text())
            _runtime_ai["api_key"] = data.get("api_key")
            _runtime_ai["model"] = data.get("model")
    except Exception:
        pass


def _save_ai_config():
    try:
        AI_CONFIG_FILE.write_text(json.dumps(_runtime_ai))
    except Exception:
        pass


_load_ai_config()


def current_key():
    return _runtime_ai["api_key"] or GROQ_API_KEY


def current_model():
    return _runtime_ai["model"] or GROQ_MODEL


def get_groq():
    key = current_key()
    if not key:
        raise HTTPException(status_code=503, detail="AI is not configured. Add a Groq API key in the AI panel.")
    return OpenAI(api_key=key, base_url="https://api.groq.com/openai/v1",
                  timeout=60.0, max_retries=1)


def groq_json(system: str, user: str, max_tokens: int = 4096) -> Dict[str, Any]:
    """Call Groq expecting a single JSON object back, with one repair retry."""
    client = get_groq()
    model = current_model()
    messages = [{"role": "system", "content": system},
                {"role": "user", "content": user}]
    last_err = ""
    for attempt in range(2):
        try:
            comp = client.chat.completions.create(
                model=model, messages=messages, temperature=0.2,
                max_completion_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            raw = comp.choices[0].message.content or ""
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                last_err = "invalid JSON"
                messages.append({"role": "assistant", "content": raw})
                messages.append({"role": "user",
                                 "content": "Your previous reply was not valid JSON. Reply again with ONLY a single valid JSON object, no markdown, no prose."})
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
            break
    raise HTTPException(status_code=502, detail=f"AI request failed: {last_err}")



# ----------------------------- Language config -----------------------------
LANGS = {
    "python": {
        "label": "Python 3",
        "src": "sol.py",
        "compile": None,
        "run": ["python3", "sol.py"],
    },
    "cpp": {
        "label": "C++17",
        "src": "sol.cpp",
        "compile": ["g++", "-O2", "-pipe", "-std=c++17", "-w", "-o", "sol", "sol.cpp"],
        "run": ["./sol"],
    },
    "java": {
        "label": "Java",
        "src": "Main.java",
        "compile": ["javac", "Main.java"],
        "run": ["java", "-cp", ".", "Main"],
    },
}


def get_run_cmd(lang: str, mem_mb: int):
    if lang == "java":
        return ["java", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1",
                "-Xshare:auto", "-Xss64m", f"-Xmx{max(64, mem_mb)}m",
                "-cp", ".", "Main"]
    return LANGS[lang]["run"]


def _truncate(s: str) -> str:
    if s is None:
        return ""
    if len(s) > MAX_STORE:
        return s[:MAX_STORE] + "\n... [truncated]"
    return s


# ----------------------------- Test generator -----------------------------
class GenError(Exception):
    pass


def _safe_eval(expr: str, env: Dict[str, int]) -> int:
    """Evaluate a small integer arithmetic expression with variables."""
    expr = expr.strip()
    if expr == "":
        raise GenError("Empty expression")
    try:
        node = ast.parse(expr, mode="eval").body
    except SyntaxError:
        raise GenError(f"Invalid expression: '{expr}'")

    def ev(n):
        if isinstance(n, ast.BinOp):
            l, r = ev(n.left), ev(n.right)
            if isinstance(n.op, ast.Add):
                return l + r
            if isinstance(n.op, ast.Sub):
                return l - r
            if isinstance(n.op, ast.Mult):
                return l * r
            if isinstance(n.op, ast.FloorDiv):
                return l // r
            if isinstance(n.op, ast.Div):
                return l // r
            if isinstance(n.op, ast.Mod):
                return l % r
            if isinstance(n.op, ast.Pow):
                return l ** r
            raise GenError("Unsupported operator")
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -ev(n.operand)
        if isinstance(n, ast.Constant) and isinstance(n.value, int):
            return n.value
        if isinstance(n, ast.Name):
            if n.id not in env:
                raise GenError(f"Unknown variable '{n.id}'")
            return env[n.id]
        raise GenError(f"Invalid token in expression: '{expr}'")

    return int(ev(node))


def _resolve_charset(spec_str: str) -> List[str]:
    s = spec_str if spec_str else "a-z"
    chars: List[str] = []
    i = 0
    while i < len(s):
        if i + 2 < len(s) and s[i + 1] == '-':
            a, b = ord(s[i]), ord(s[i + 2])
            if a > b:
                a, b = b, a
            chars.extend(chr(c) for c in range(a, b + 1))
            i += 3
        else:
            chars.append(s[i])
            i += 1
    if not chars:
        raise GenError("Empty charset")
    return chars


def _gen_scalar(rng: random.Random, spec: Dict[str, Any], env: Dict[str, int]):
    """Return (string_value, int_value_or_None) for a typed scalar spec."""
    t = spec.get("type", "int")
    if t == "int":
        lo = _safe_eval(str(spec.get("min", "0")), env)
        hi = _safe_eval(str(spec.get("max", "0")), env)
        if lo > hi:
            raise GenError(f"int: min({lo}) > max({hi})")
        v = rng.randint(lo, hi)
        return str(v), v
    if t == "float":
        try:
            lo = float(spec.get("min", 0))
            hi = float(spec.get("max", 1))
        except (TypeError, ValueError):
            raise GenError("float min/max must be numbers")
        if lo > hi:
            raise GenError(f"float: min({lo}) > max({hi})")
        dec = int(spec.get("decimals", 2))
        dec = max(0, min(dec, 12))
        return f"{rng.uniform(lo, hi):.{dec}f}", None
    if t == "char":
        cs = _resolve_charset(str(spec.get("charset", "a-z")))
        return rng.choice(cs), None
    if t == "string":
        cs = _resolve_charset(str(spec.get("charset", "a-z")))
        ln = _safe_eval(str(spec.get("len", "1")), env)
        if ln > 200000:
            raise GenError("string too long (>200000)")
        return "".join(rng.choice(cs) for _ in range(max(0, ln))), None
    raise GenError(f"Unknown type '{t}'")


def generate_simple(cfg: Dict[str, Any], rng: random.Random) -> str:
    env: Dict[str, int] = {}
    disp: Dict[str, str] = {}
    for v in cfg.get("variables", []):
        name = v["name"].strip()
        if not name:
            raise GenError("Variable name cannot be empty")
        sval, ival = _gen_scalar(rng, v, env)
        if ival is not None:
            env[name] = ival
        disp[name] = sval

    out_lines: List[str] = []
    for ln in cfg.get("lines", []):
        kind = ln.get("kind")
        if kind == "vars":
            vals = [disp[n] if n in disp else str(_safe_eval(str(n), env))
                    for n in ln.get("vars", [])]
            out_lines.append(" ".join(vals))
        elif kind == "array":
            count = _safe_eval(str(ln.get("count", "0")), env)
            if count > 200000:
                raise GenError("Array too large (>200000)")
            count = max(0, count)
            t = ln.get("type", "int")
            if t == "int" and ln.get("distinct"):
                lo = _safe_eval(str(ln.get("min", "0")), env)
                hi = _safe_eval(str(ln.get("max", "0")), env)
                if lo > hi:
                    raise GenError(f"Array: min({lo}) > max({hi})")
                if count > (hi - lo + 1):
                    raise GenError(f"Distinct array needs range size >= count ({hi - lo + 1} < {count})")
                out_lines.append(" ".join(str(x) for x in rng.sample(range(lo, hi + 1), count)))
            else:
                out_lines.append(" ".join(_gen_scalar(rng, ln, env)[0] for _ in range(count)))
        elif kind == "const":
            out_lines.append(str(ln.get("text", "")))
        else:
            raise GenError(f"Unknown line kind '{kind}'")
    return "\n".join(out_lines) + "\n"


def generate_advanced(template: str, rng: random.Random) -> str:
    """A small readable DSL.

    n = int(1, 100)
    m = int(1, n)
    print(n, m)
    array(n, 1, 1000000)
    grid(n, m, 0, 9)
    blank
    """
    env: Dict[str, int] = {}
    out_lines: List[str] = []

    def call_args(s: str) -> List[str]:
        s = s.strip()
        if not (s.startswith("(") and s.endswith(")")):
            raise GenError(f"Expected parentheses in: '{s}'")
        inner = s[1:-1].strip()
        return [a for a in _split_args(inner)] if inner else []

    for raw in template.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line == "blank":
            out_lines.append("")
            continue
        # assignment
        if "=" in line and line.split("=")[0].strip().isidentifier() and not line.startswith("print"):
            name, rhs = line.split("=", 1)
            name = name.strip()
            rhs = rhs.strip()
            if not rhs.startswith("int"):
                raise GenError(f"Assignment must use int(lo, hi): '{line}'")
            args = call_args(rhs[3:])
            if len(args) != 2:
                raise GenError(f"int() needs 2 args: '{line}'")
            lo = _safe_eval(args[0], env)
            hi = _safe_eval(args[1], env)
            if lo > hi:
                raise GenError(f"int(): lo({lo}) > hi({hi}) in '{line}'")
            env[name] = rng.randint(lo, hi)
            continue
        if line.startswith("print"):
            args = call_args(line[5:])
            out_lines.append(" ".join(str(_safe_eval(a, env)) for a in args))
            continue
        if line.startswith("array"):
            args = call_args(line[5:])
            if len(args) != 3:
                raise GenError(f"array() needs 3 args (count, lo, hi): '{line}'")
            count = _safe_eval(args[0], env)
            lo = _safe_eval(args[1], env)
            hi = _safe_eval(args[2], env)
            if lo > hi:
                raise GenError(f"array(): lo>hi in '{line}'")
            if count > 200000:
                raise GenError("array too large (>200000)")
            out_lines.append(" ".join(str(rng.randint(lo, hi)) for _ in range(max(0, count))))
            continue
        if line.startswith("grid"):
            args = call_args(line[4:])
            if len(args) != 4:
                raise GenError(f"grid() needs 4 args (rows, cols, lo, hi): '{line}'")
            rows = _safe_eval(args[0], env)
            cols = _safe_eval(args[1], env)
            lo = _safe_eval(args[2], env)
            hi = _safe_eval(args[3], env)
            if lo > hi:
                raise GenError(f"grid(): lo>hi in '{line}'")
            if rows * cols > 200000:
                raise GenError("grid too large")
            for _ in range(max(0, rows)):
                out_lines.append(" ".join(str(rng.randint(lo, hi)) for _ in range(max(0, cols))))
            continue
        if line.startswith("chars"):
            args = call_args(line[5:])
            if len(args) != 2:
                raise GenError(f"chars() needs 2 args (count, charset): '{line}'")
            count = _safe_eval(args[0], env)
            cs = _resolve_charset(args[1].strip().strip('"\''))
            out_lines.append(" ".join(rng.choice(cs) for _ in range(max(0, count))))
            continue
        if line.startswith("word"):
            args = call_args(line[4:])
            if len(args) != 2:
                raise GenError(f"word() needs 2 args (length, charset): '{line}'")
            length = _safe_eval(args[0], env)
            cs = _resolve_charset(args[1].strip().strip('"\''))
            out_lines.append("".join(rng.choice(cs) for _ in range(max(0, length))))
            continue
        if line.startswith("floats") or line.startswith("reals"):
            head = 6 if line.startswith("floats") else 5
            args = call_args(line[head:])
            if len(args) not in (3, 4):
                raise GenError(f"floats() needs 3-4 args (count, lo, hi[, decimals]): '{line}'")
            count = _safe_eval(args[0], env)
            lo = float(args[1])
            hi = float(args[2])
            if lo > hi:
                raise GenError(f"floats(): lo>hi in '{line}'")
            dec = max(0, min(_safe_eval(args[3], env) if len(args) == 4 else 2, 12))
            out_lines.append(" ".join(f"{rng.uniform(lo, hi):.{dec}f}" for _ in range(max(0, count))))
            continue
        raise GenError(f"Unknown statement: '{line}'")

    return "\n".join(out_lines) + "\n"


def _split_args(inner: str) -> List[str]:
    args, depth, cur = [], 0, ""
    for ch in inner:
        if ch == "," and depth == 0:
            args.append(cur.strip())
            cur = ""
        else:
            if ch in "([":
                depth += 1
            elif ch in ")]":
                depth -= 1
            cur += ch
    if cur.strip():
        args.append(cur.strip())
    return args


def generate_simple_text(template: str, rng: random.Random) -> str:
    """A beginner-friendly readable template.

    let n = 1..8            # random int variable
    print n                 # print values on one line
    list n ints in 1..20    # n random ints (add 'distinct' for unique)
    list n chars in a-z     # n random characters
    word 5 in a-z           # one random string of length 5
    text YES                # a fixed line of text
    blank                   # an empty line
    """
    env: Dict[str, int] = {}
    out: List[str] = []
    for raw in template.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line == "blank":
            out.append("")
        elif line.startswith("let "):
            body = line[4:].strip()
            if "=" not in body:
                raise GenError(f"'let' needs '=' — try: let n = 1..10   (got: {line})")
            name, rng_part = body.split("=", 1)
            name = name.strip()
            rng_part = rng_part.strip()
            if not name.isidentifier():
                raise GenError(f"Invalid variable name '{name}'")
            if ".." not in rng_part:
                raise GenError(f"Range must look like lo..hi — try: let {name} = 1..100   (got: {line})")
            lo_s, hi_s = rng_part.split("..", 1)
            lo, hi = _safe_eval(lo_s, env), _safe_eval(hi_s, env)
            if lo > hi:
                raise GenError(f"'{name}': low({lo}) is greater than high({hi})")
            env[name] = rng.randint(lo, hi)
        elif line.startswith("print "):
            args = line[6:].replace(",", " ").split()
            out.append(" ".join(str(_safe_eval(a, env)) for a in args))
        elif line.startswith("list "):
            body = line[5:].strip()
            if " in " not in body:
                raise GenError(f"'list' needs 'in' — try: list n ints in 1..100   (got: {line})")
            left, right = body.split(" in ", 1)
            lt = left.strip().split()
            if not lt:
                raise GenError(f"'list' is missing a count — try: list n ints in 1..100   (got: {line})")
            kind = lt[-1].lower()
            count_words = lt[:-1]
            distinct = "distinct" in [w.lower() for w in count_words]
            count_words = [w for w in count_words if w.lower() != "distinct"]
            count_expr = " ".join(count_words).strip()
            if not count_expr:
                raise GenError(f"'list' is missing a count — try: list n ints in 1..100   (got: {line})")
            count = max(0, _safe_eval(count_expr, env))
            if count > 200000:
                raise GenError("list is too large (>200000)")
            if kind in ("ints", "int", "numbers"):
                if ".." not in right:
                    raise GenError(f"ints range must be lo..hi — try: list {count_expr} ints in 1..100   (got: {line})")
                lo_s, hi_s = right.strip().split("..", 1)
                lo, hi = _safe_eval(lo_s, env), _safe_eval(hi_s, env)
                if lo > hi:
                    raise GenError(f"list range {lo}>{hi} in: {line}")
                if distinct:
                    if count > (hi - lo + 1):
                        raise GenError(f"'distinct' needs the range to hold at least {count} values (in: {line})")
                    out.append(" ".join(str(x) for x in rng.sample(range(lo, hi + 1), count)))
                else:
                    out.append(" ".join(str(rng.randint(lo, hi)) for _ in range(count)))
            elif kind in ("chars", "char", "letters"):
                cs = _resolve_charset(right.strip())
                out.append(" ".join(rng.choice(cs) for _ in range(count)))
            elif kind in ("floats", "float", "reals", "decimals"):
                if ".." not in right:
                    raise GenError(f"floats range must be lo..hi — try: list {count_expr} floats in 0..1   (got: {line})")
                lo_s, hi_s = right.strip().split("..", 1)
                lo, hi = float(lo_s), float(hi_s)
                if lo > hi:
                    raise GenError(f"list range {lo}>{hi} in: {line}")
                out.append(" ".join(f"{rng.uniform(lo, hi):.2f}" for _ in range(count)))
            else:
                raise GenError(f"'list' must say 'ints', 'floats' or 'chars' — got '{kind}' in: {line}")
        elif line.startswith("word "):
            body = line[5:].strip()
            if " in " not in body:
                raise GenError(f"'word' needs 'in' — try: word 5 in a-z   (got: {line})")
            len_s, cs_s = body.split(" in ", 1)
            L = max(0, _safe_eval(len_s.strip(), env))
            if L > 200000:
                raise GenError("word is too long")
            cs = _resolve_charset(cs_s.strip())
            out.append("".join(rng.choice(cs) for _ in range(L)))
        elif line.startswith("text "):
            out.append(line[5:])
        else:
            raise GenError(f"Don't understand: '{line}'. Use let / print / list / word / text / blank.")
    return "\n".join(out) + "\n"


def build_generator(gen: Dict[str, Any]):
    mode = gen.get("mode", "simple")

    def make(rng: random.Random) -> str:
        if mode == "advanced":
            return generate_advanced(gen.get("template", ""), rng)
        if "text" in gen:
            return generate_simple_text(gen.get("text", ""), rng)
        return generate_simple(gen, rng)  # legacy visual-builder form

    return make


# ----------------------------- Execution -----------------------------
def execute(run_cmd, input_data: str, time_limit_ms: int, mem_limit_mb: int, cwd: str,
            cancel_event: Optional[threading.Event] = None):
    tl = time_limit_ms / 1000.0
    mem_limit_kb = mem_limit_mb * 1024

    try:
        proc = subprocess.Popen(run_cmd, stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                cwd=cwd)
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "rc": -1, "time_ms": 0,
                "mem_kb": 0, "timed_out": False, "mle": False}

    peak_kb = [0]
    mle = [False]
    stop = threading.Event()

    def sample():
        path = f"/proc/{proc.pid}/status"
        while not stop.is_set():
            if cancel_event is not None and cancel_event.is_set():
                proc.kill()
                return
            try:
                with open(path) as f:
                    for line in f:
                        if line.startswith("VmRSS:"):
                            kb = int(line.split()[1])
                            if kb > peak_kb[0]:
                                peak_kb[0] = kb
                            if kb > mem_limit_kb:
                                mle[0] = True
                                proc.kill()
                            break
            except Exception:
                pass
            time.sleep(0.004)

    t = threading.Thread(target=sample, daemon=True)
    t.start()
    start = time.monotonic()
    timed_out = False
    try:
        out, err = proc.communicate(input=input_data.encode(), timeout=tl + 1.0)
    except subprocess.TimeoutExpired:
        timed_out = True
        proc.kill()
        try:
            out, err = proc.communicate()
        except Exception:
            out, err = b"", b""
    elapsed = time.monotonic() - start
    stop.set()
    return {
        "stdout": out.decode(errors="replace") if out else "",
        "stderr": err.decode(errors="replace") if err else "",
        "rc": proc.returncode,
        "time_ms": int(elapsed * 1000),
        "mem_kb": peak_kb[0],
        "timed_out": timed_out,
        "mle": mle[0],
    }


def compile_source(lang: str, code: str, workdir: str):
    conf = LANGS[lang]
    src_path = os.path.join(workdir, conf["src"])
    with open(src_path, "w") as f:
        f.write(code)
    if conf["compile"] is None:
        # sanity check python syntax for CE detection
        if lang == "python":
            r = subprocess.run(["python3", "-m", "py_compile", conf["src"]],
                               cwd=workdir, capture_output=True, text=True)
            if r.returncode != 0:
                return False, r.stderr
        return True, ""
    r = subprocess.run(conf["compile"], cwd=workdir, capture_output=True,
                       text=True, timeout=60)
    if r.returncode != 0:
        return False, r.stderr or r.stdout
    return True, ""


def normalize_tokens(s: str) -> List[str]:
    return s.split()


# ----------------------------- Generator provider -----------------------------
GEN_TIME_MS = 8000
GEN_MEM_MB = 512


class Generator:
    """Produces test inputs from any generator mode (simple / advanced / code)."""

    def __init__(self, gen: Dict[str, Any]):
        self.gen = gen
        self.mode = gen.get("mode", "simple")
        self.workdir = None
        self.run_cmd = None
        if self.mode == "code":
            code = gen.get("code", "")
            lang = gen.get("language", "python")
            if lang not in LANGS:
                raise GenError(f"Unsupported generator language '{lang}'")
            if not code.strip():
                raise GenError("Generator code is empty")
            self.workdir = tempfile.mkdtemp(prefix="cpgen_")
            ok, msg = compile_source(lang, code, self.workdir)
            if not ok:
                raise GenError("Generator failed to compile:\n" + msg)
            self.run_cmd = get_run_cmd(lang, GEN_MEM_MB)

    def sample(self, seed: int) -> str:
        if self.mode == "code":
            res = execute(self.run_cmd + [str(seed)], "", GEN_TIME_MS, GEN_MEM_MB, self.workdir)
            if res["timed_out"]:
                raise GenError("Generator timed out (took too long to print a test)")
            if res.get("mle"):
                raise GenError("Generator exceeded memory")
            if res["rc"] != 0:
                raise GenError("Generator crashed:\n" + (res["stderr"][:800] or f"exit code {res['rc']}"))
            return res["stdout"]
        rng = random.Random(seed)
        if self.mode == "advanced":
            return generate_advanced(self.gen.get("template", ""), rng)
        if "text" in self.gen:
            return generate_simple_text(self.gen.get("text", ""), rng)
        return generate_simple(self.gen, rng)

    def close(self):
        if self.workdir:
            shutil.rmtree(self.workdir, ignore_errors=True)


# ----------------------------- Models -----------------------------
class StressRequest(BaseModel):
    userCode: str
    userLang: str
    bruteCode: str
    bruteLang: str
    generator: Dict[str, Any]
    numTests: int = Field(default=20, ge=1, le=5000)
    timeLimitMs: int = Field(default=2000, ge=10, le=60000)
    memLimitMb: int = Field(default=256, ge=4, le=8192)
    stopOnFirstFail: bool = True
    seed: Optional[int] = None


class PreviewRequest(BaseModel):
    generator: Dict[str, Any]
    seed: Optional[int] = None


# ----------------------------- Routes -----------------------------
@api_router.get("/")
async def root():
    return {"message": "CP Stress Tester API"}


@api_router.get("/languages")
async def languages():
    return [{"id": k, "label": v["label"]} for k, v in LANGS.items()]


@api_router.post("/preview")
def preview(req: PreviewRequest):
    seed = req.seed if req.seed is not None else random.randrange(1 << 30)
    gen = None
    try:
        gen = Generator(req.generator)
        sample = gen.sample(seed)
        return {"ok": True, "input": sample}
    except GenError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
    finally:
        if gen:
            gen.close()


def _verdict_for(res, tl_ms, mem_mb):
    if res["timed_out"] or res["time_ms"] > tl_ms:
        return "TLE"
    if res.get("mle") or res["mem_kb"] > mem_mb * 1024:
        return "MLE"
    if res["rc"] != 0:
        return "RTE"
    return None


# ----------------------------- Job manager -----------------------------
JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()


def _prune_jobs():
    now = time.time()
    with JOBS_LOCK:
        stale = [jid for jid, j in JOBS.items() if now - j["created"] > 600]
        for jid in stale:
            JOBS.pop(jid, None)


def _job_snapshot(job: Dict[str, Any]) -> Dict[str, Any]:
    counts = job["counts"]
    return {
        "jobId": job["id"],
        "status": job["status"],
        "phase": job["phase"],
        "total": job["total"],
        "done": job["done"],
        "seed": job.get("seed"),
        "ce": job.get("ce"),
        "message": job.get("message"),
        "summary": {
            "total": len(job["tests"]),
            "passed": counts["AC"],
            "firstFail": job.get("first_fail"),
            "counts": counts,
        },
        "tests": job["tests"],
    }


def _run_job(job: Dict[str, Any], req: "StressRequest"):
    cancel = job["cancel"]
    base = tempfile.mkdtemp(prefix="cpjudge_")
    user_dir = os.path.join(base, "user")
    brute_dir = os.path.join(base, "brute")
    os.makedirs(user_dir)
    os.makedirs(brute_dir)
    pool = ThreadPoolExecutor(max_workers=2)
    gen_obj = None
    try:
        try:
            gen_obj = Generator(req.generator)
            gen_obj.sample(12345)
        except GenError as e:
            job["status"] = "GEN_ERROR"
            job["message"] = str(e)
            job["phase"] = "done"
            return

        job["phase"] = "compiling"
        ok, msg = compile_source(req.userLang, req.userCode, user_dir)
        if not ok:
            job["status"] = "CE"
            job["ce"] = {"target": "user", "message": _truncate(msg)}
            job["phase"] = "done"
            return
        ok, msg = compile_source(req.bruteLang, req.bruteCode, brute_dir)
        if not ok:
            job["status"] = "CE"
            job["ce"] = {"target": "brute", "message": _truncate(msg)}
            job["phase"] = "done"
            return

        if cancel.is_set():
            job["status"] = "cancelled"
            job["phase"] = "done"
            return

        job["phase"] = "running"
        user_run = get_run_cmd(req.userLang, req.memLimitMb)
        brute_run = get_run_cmd(req.bruteLang, req.memLimitMb + 256)

        base_seed = req.seed if req.seed is not None else random.randrange(1 << 30)
        job["seed"] = base_seed
        rng = random.Random(base_seed)
        ref_tl = max(req.timeLimitMs * 3, 5000)
        # generous budget derived from config (jobs run in a background thread)
        budget_s = req.numTests * (req.timeLimitMs / 1000.0 * 2 + 0.5) + 30
        deadline = time.monotonic() + budget_s

        for i in range(req.numTests):
            if cancel.is_set() or time.monotonic() > deadline:
                break

            test_seed = rng.randrange(1 << 30)
            try:
                inp = gen_obj.sample(test_seed)
            except GenError as e:
                job["status"] = "GEN_ERROR"
                job["message"] = str(e)
                job["phase"] = "done"
                return

            # run reference and user solution concurrently
            f_ref = pool.submit(execute, brute_run, inp, ref_tl,
                                req.memLimitMb + 256, brute_dir, cancel)
            f_usr = pool.submit(execute, user_run, inp, req.timeLimitMs,
                                req.memLimitMb, user_dir, cancel)
            ref = f_ref.result()
            res = f_usr.result()

            if cancel.is_set():
                break

            if ref["timed_out"] or ref["rc"] != 0:
                note = "Reference (correct) solution failed: " + (
                    "timeout" if ref["timed_out"] else f"runtime error rc={ref['rc']}")
                job["counts"]["ERR"] += 1
                job["tests"].append({
                    "index": i + 1, "verdict": "ERR", "time_ms": ref["time_ms"],
                    "mem_kb": 0, "note": note, "input": _truncate(inp),
                    "expected": "", "output": _truncate(ref["stderr"]),
                })
                if job["first_fail"] is None:
                    job["first_fail"] = i + 1
                job["done"] = i + 1
                if req.stopOnFirstFail:
                    break
                continue

            expected = ref["stdout"]
            verdict = _verdict_for(res, req.timeLimitMs, req.memLimitMb)
            if verdict is None:
                verdict = "AC" if normalize_tokens(res["stdout"]) == normalize_tokens(expected) else "WA"

            job["counts"][verdict] = job["counts"].get(verdict, 0) + 1
            entry = {"index": i + 1, "verdict": verdict, "time_ms": res["time_ms"],
                     "mem_kb": res["mem_kb"], "seed": test_seed}
            if verdict != "AC":
                entry["input"] = _truncate(inp)
                entry["expected"] = _truncate(expected)
                entry["output"] = _truncate(res["stdout"])
                if res["stderr"]:
                    entry["stderr"] = _truncate(res["stderr"])
                if job["first_fail"] is None:
                    job["first_fail"] = i + 1
            elif i < 300:
                # keep passing-test details (capped) so the user can inspect AC cases
                entry["input"] = _truncate(inp)
                entry["expected"] = _truncate(expected)
                entry["output"] = _truncate(res["stdout"])
            job["tests"].append(entry)
            job["done"] = i + 1

            if verdict != "AC" and req.stopOnFirstFail:
                break

        job["status"] = "cancelled" if cancel.is_set() else "completed"
        job["phase"] = "done"
    except Exception as e:
        logger.exception("job failed")
        job["status"] = "error"
        job["message"] = f"{type(e).__name__}: {e}"
        job["phase"] = "done"
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
        shutil.rmtree(base, ignore_errors=True)
        if gen_obj:
            gen_obj.close()


@api_router.post("/run/start")
def run_start(req: StressRequest):
    if req.userLang not in LANGS or req.bruteLang not in LANGS:
        raise HTTPException(status_code=400, detail="Unsupported language")
    _prune_jobs()
    job_id = uuid.uuid4().hex
    job = {
        "id": job_id, "status": "running", "phase": "queued",
        "total": req.numTests, "done": 0, "tests": [],
        "counts": {"AC": 0, "WA": 0, "TLE": 0, "RTE": 0, "MLE": 0, "ERR": 0},
        "first_fail": None, "cancel": threading.Event(),
        "created": time.time(),
    }
    with JOBS_LOCK:
        JOBS[job_id] = job
    threading.Thread(target=_run_job, args=(job, req), daemon=True).start()
    return {"jobId": job_id, "total": req.numTests}


@api_router.get("/run/status/{job_id}")
def run_status(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_snapshot(job)


@api_router.post("/run/cancel/{job_id}")
def run_cancel(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    job["cancel"].set()
    return {"ok": True}


@api_router.post("/run")
def run_stress(req: StressRequest):
    """Synchronous run (used for direct API/testing)."""
    if req.userLang not in LANGS or req.bruteLang not in LANGS:
        raise HTTPException(status_code=400, detail="Unsupported language")
    job = {
        "id": "sync", "status": "running", "phase": "queued",
        "total": req.numTests, "done": 0, "tests": [],
        "counts": {"AC": 0, "WA": 0, "TLE": 0, "RTE": 0, "MLE": 0, "ERR": 0},
        "first_fail": None, "cancel": threading.Event(), "created": time.time(),
    }
    _run_job(job, req)
    snap = _job_snapshot(job)
    if job["status"] in ("CE", "GEN_ERROR", "error"):
        return {"status": job["status"], "ce": job.get("ce"), "message": job.get("message")}
    return {"status": "completed", "seed": job.get("seed"),
            "summary": snap["summary"], "tests": snap["tests"]}


# ----------------------------- AI (Groq) endpoints -----------------------------
DSL_SPEC = """The generator uses this line-based DSL (INTEGERS ONLY):
- `name = int(lo, hi)` : assign a random integer in [lo, hi] to a variable. lo/hi may be integer arithmetic expressions using previously defined variables and + - * // % ** (e.g. `m = int(1, n-1)`).
- `print(expr, expr, ...)` : print the given values space-separated on one line.
- `array(count, lo, hi)` : print `count` random integers in [lo, hi] space-separated on one line.
- `grid(rows, cols, lo, hi)` : print `rows` lines, each with `cols` random integers in [lo, hi]. Great for matrices or edge lists (e.g. `grid(m, 2, 1, n)` prints m edges "u v").
- `blank` : print an empty line.
- `# comment` : ignored.
Rules: variables must be defined before use. There are NO loops and NO strings/chars/floats. Keep sizes SMALL (e.g. n up to ~10-50, small value ranges) so counterexamples are tiny and easy to debug. The output MUST match the problem's input format exactly (order of lines/values)."""

SOLUTION_SYSTEM = """You are a world-class competitive programming expert. You write a REFERENCE solution that is used purely as a CORRECTNESS ORACLE for stress testing another solution.
Absolute rules:
- Read ONLY from standard input and write ONLY to standard output, matching the described input/output format EXACTLY.
- Correctness is the ONLY priority. Prefer the simplest, most obviously-correct approach (brute force is welcome) over clever or fast code.
- Print exactly the required output and NOTHING else: no prompts, no debug lines, no trailing text.
- C++: `#include <bits/stdc++.h>`, standard iostream/scanf I/O, C++17.
- Java: the public class MUST be named exactly `Main`.
- Python: use input()/sys.stdin.
- Handle edge cases (empty, single element, max/min bounds) correctly.
Return ONLY a single JSON object: {"code": "<full source code as a string>", "explanation": "<1-3 sentence summary>"}. No markdown fences inside code."""

EXPLAIN_SYSTEM = """You are a sharp competitive programming mentor. You are given a problem (optional), a FAILING test case (the input, the correct expected output, and the user's WRONG output) and the user's source code.
Analyze precisely WHY the user's code produces the wrong output on THIS input. Reference the actual values/lines. Then give a concise, actionable hint to fix it (do NOT dump a full corrected solution unless the fix is a one-liner).
Return ONLY a single JSON object: {"diagnosis": "<what goes wrong and why, 2-4 sentences>", "hint": "<a concrete fix hint, 1-3 sentences>"}."""


class AISolutionRequest(BaseModel):
    problem: str = Field(min_length=1, max_length=20000)
    language: str = "cpp"


class AIGeneratorRequest(BaseModel):
    problem: str = Field(min_length=1, max_length=20000)


class AIExplainRequest(BaseModel):
    problem: Optional[str] = ""
    language: str = "cpp"
    code: str
    input: str
    expected: str
    output: str


class AIConfigRequest(BaseModel):
    apiKey: Optional[str] = None
    model: Optional[str] = None
    clear: bool = False


@api_router.get("/ai/status")
async def ai_status():
    return {"enabled": bool(current_key()), "model": current_model(),
            "usingUserKey": bool(_runtime_ai["api_key"]),
            "defaultAvailable": bool(GROQ_API_KEY)}


@api_router.post("/ai/config")
def ai_config(req: AIConfigRequest):
    if req.clear:
        _runtime_ai["api_key"] = None
        _runtime_ai["model"] = None
        _save_ai_config()
        return {"ok": True, "enabled": bool(current_key()), "model": current_model(),
                "usingUserKey": False, "defaultAvailable": bool(GROQ_API_KEY)}

    test_key = (req.apiKey or "").strip() or current_key()
    test_model = (req.model or "").strip() or current_model()
    if not test_key:
        raise HTTPException(status_code=400, detail="No API key provided.")
    # validate by listing models with the candidate key
    try:
        probe = OpenAI(api_key=test_key, base_url="https://api.groq.com/openai/v1",
                       timeout=20.0, max_retries=0)
        probe.models.list()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid API key or could not reach Groq.")

    if req.apiKey is not None and req.apiKey.strip():
        _runtime_ai["api_key"] = req.apiKey.strip()
    if req.model is not None and req.model.strip():
        _runtime_ai["model"] = req.model.strip()
    _save_ai_config()
    return {"ok": True, "enabled": True, "model": current_model(),
            "usingUserKey": bool(_runtime_ai["api_key"]),
            "defaultAvailable": bool(GROQ_API_KEY)}


@api_router.post("/ai/generate-solution")
def ai_generate_solution(req: AISolutionRequest):
    if req.language not in LANGS:
        raise HTTPException(status_code=400, detail="Unsupported language")
    user = (f"Problem statement:\n{req.problem}\n\n"
            f"Target language: {LANGS[req.language]['label']} ({req.language}).\n"
            f"Write the reference solution now.")
    data = groq_json(SOLUTION_SYSTEM, user)
    code = data.get("code", "")
    if not code.strip():
        raise HTTPException(status_code=502, detail="AI returned empty code")
    return {"code": code, "explanation": data.get("explanation", ""), "language": req.language}


GENERATOR_SYSTEM = ("You are an expert at writing competitive-programming random test generators. "
                    "Return ONLY a single valid JSON object as instructed, no markdown, no prose.")


@api_router.post("/ai/generate-generator")
def ai_generate_generator(req: AIGeneratorRequest):
    base_user = (f"Problem statement:\n{req.problem}\n\n{DSL_SPEC}\n\n"
                 "Produce a random-test generator template in this DSL that outputs a valid random "
                 "input for the problem. Return ONLY JSON: "
                 '{"template": "<the DSL template>", "explanation": "<1-2 sentences>"}.')
    user = base_user
    last_err = None
    for attempt in range(2):
        data = groq_json(GENERATOR_SYSTEM, user)
        template = data.get("template", "")
        try:
            build_generator({"mode": "advanced", "template": template})(random.Random(7))
            return {"template": template, "explanation": data.get("explanation", ""), "mode": "advanced"}
        except GenError as e:
            last_err = str(e)
            user = base_user + (f"\n\nIMPORTANT: your previous template failed with this error: '{last_err}'. "
                                "Fix it and strictly follow the DSL grammar (integers only, define variables before use).")
    raise HTTPException(status_code=502, detail=f"AI generator template was invalid: {last_err}")


@api_router.post("/ai/explain")
def ai_explain(req: AIExplainRequest):
    prob = f"Problem statement:\n{req.problem}\n\n" if (req.problem or "").strip() else ""
    user = (f"{prob}Language: {req.language}\n\n"
            f"User's code:\n```\n{req.code}\n```\n\n"
            f"Failing input:\n```\n{req.input}\n```\n\n"
            f"Expected output:\n```\n{req.expected}\n```\n\n"
            f"User's wrong output:\n```\n{req.output}\n```\n\n"
            "Explain the bug and give a hint.")
    data = groq_json(EXPLAIN_SYSTEM, user, max_tokens=1500)
    return {"diagnosis": data.get("diagnosis", ""), "hint": data.get("hint", "")}


EXPLAIN_CODE_SYSTEM = """You are a patient competitive-programming teacher. You are given a solution's source code (and optionally the problem it solves). Produce a DETAILED but clear explanation of how the code works, aimed at a learner.
Return ONLY a single JSON object with these fields:
{
  "approach": "<the overall idea / algorithm in 2-4 sentences>",
  "steps": ["<step 1 of what the code does>", "<step 2>", "..."],
  "complexity": "<time and space complexity, e.g. O(n log n) time, O(n) space, with a short why>",
  "edgeCases": "<edge cases the code handles or should watch out for, 1-3 sentences>"
}
Be specific to THIS code — reference its actual variables, loops and logic. Keep each steps[] item to one concise sentence."""


class AIExplainCodeRequest(BaseModel):
    code: str
    language: str = "cpp"
    problem: Optional[str] = ""


@api_router.post("/ai/explain-code")
def ai_explain_code(req: AIExplainCodeRequest):
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="No code provided")
    prob = f"Problem it solves:\n{req.problem}\n\n" if (req.problem or "").strip() else ""
    user = (f"{prob}Language: {req.language}\n\n"
            f"Source code:\n```\n{req.code}\n```\n\n"
            "Explain in detail how this code works.")
    data = groq_json(EXPLAIN_CODE_SYSTEM, user, max_tokens=2500)
    steps = data.get("steps", [])
    if isinstance(steps, str):
        steps = [steps]
    return {
        "approach": data.get("approach", ""),
        "steps": steps,
        "complexity": data.get("complexity", ""),
        "edgeCases": data.get("edgeCases", ""),
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
