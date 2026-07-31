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
- Full stress-test engine with AC/WA/TLE/RTE/CE/MLE verdicts — verified via testing agent (backend 12/12, frontend all flows pass).
- Simple visual generator builder + Advanced DSL, both with live preview.
- 3-column dark IDE-style UI, code editors with syntax highlighting + language selectors, results dashboard with expandable failing-test diff, summary verdict counts, run config (tests/time/mem/stop-on-first-fail).

## Backlog / Remaining
- **P1**: AI generation via Grok API (auto-write generator / brute solution) — deferred per user.
- **P2**: Custom checker (special judge) for problems with multiple valid answers.
- **P2**: Save/load problems (would require accounts — currently no login).
- **P2**: Global concurrency semaphore on /api/run to protect container under heavy parallel use.

## Next Tasks
- Wire Grok API for AI-assisted generator/solution creation when user provides key.
