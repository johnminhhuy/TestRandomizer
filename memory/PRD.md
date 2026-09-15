# STRESSLAB — Competitive Programming Stress Tester

## Original Problem Statement
Build an app that stress-tests competitive programming code: take the user's solution, a correct/brute answer solution, and a template test-data generator; generate random tests; compare the user's result vs the answer result. Modern, user-friendly, AI-ready later. Full CP verdicts (TLE, RTE, WA, etc.). Support multiple languages.

## User Choices
- Languages at launch: C++, Python, Java
- Generator: Simple (visual builder) + Advanced (readable DSL), both with live preview
- Verdicts: AC, WA, TLE, RTE, CE, MLE
- Single-page tool, no login
- AI generation later — user prefers Grok API (deferred)

## Architecture
- **Frontend**: React (CRA + craco), Tailwind, shadcn, CodeMirror (`@uiw/react-codemirror`) editors, phosphor icons, sonner toasts. Dark "technical grid" theme (Chivo/IBM Plex Sans/JetBrains Mono).
  - `src/pages/StressTester.jsx` — 3-column layout orchestrator
  - `src/components/CodeEditor.jsx`, `GeneratorPanel.jsx`, `ResultsPanel.jsx`
  - `src/lib/apiClient.js`, `src/lib/constants.js`
- **Backend**: FastAPI (`/app/backend/server.py`). Stateless; no DB used.
  - `GET /api/languages`, `POST /api/preview`, `POST /api/run`
  - Execution engine: compiles (g++ -O2, javac) / runs (python3, ./sol, java -Xmx), enforces TLE via wall timeout, MLE via VmRSS polling + kill, RTE via exit code, WA via token comparison, CE at compile.
  - Generator: Simple config (variables + output lines) and Advanced DSL (`int(lo,hi)`, `print`, `array`, `grid`, `blank`) with safe arithmetic evaluator.
- **Runtimes installed**: g++ 12, Python 3.11, OpenJDK 17.

## User Personas
- Competitive programmers who want to find counterexamples where their solution disagrees with a known-correct/brute solution.

## Core Requirements (static)
- Take user code + correct code + generator, run N random tests, report per-test verdict with time/memory and a diff for failures.
- Support C++, Python, Java. Full verdict set.

## Implemented (2026-06)
- Full stress-test engine with AC/WA/TLE/RTE/CE/MLE verdicts — verified via testing agent.
- Simple visual generator builder + Advanced DSL, both with live preview.
- Typed & constrained variables (int/float/char/string + distinct arrays); job-based live progress + cancel; concurrent reference/user execution.
- **AI (Groq, openai/gpt-oss-120b)**: generate reference solution, generate test generator (self-validated DSL), and explain-a-counterexample (diagnosis + hint). Key in backend/.env (GROQ_API_KEY). Endpoints: /api/ai/status, /api/ai/generate-solution, /api/ai/generate-generator, /api/ai/explain.
- **GUI declutter**: run config moved to a header Settings popover; AI slide-over from header; left panel now just the generator.

## Notes
- NOTE: user said "grok" but pasted a Groq (gsk_) key; built on Groq accordingly.

## Backlog / Remaining
- **P2**: Custom checker (special judge) for multiple valid answers.
- **P2**: AI generator supports strings/chars (currently DSL is int-only).
- **P2**: Save/load problems (needs accounts).

## Next Tasks
- Wire Grok API for AI-assisted generator/solution creation when user provides key.
