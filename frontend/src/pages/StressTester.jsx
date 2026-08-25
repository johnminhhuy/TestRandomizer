import React, { useState, useRef } from "react";
import { CodeEditor } from "../components/CodeEditor";
import { GeneratorPanel } from "../components/GeneratorPanel";
import { ResultsPanel } from "../components/ResultsPanel";
import { AIAssistant } from "../components/AIAssistant";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { startRun, getRunStatus, cancelRun } from "../lib/apiClient";
import {
  DEFAULT_USER_CPP,
  DEFAULT_BRUTE_CPP,
  DEFAULT_SIMPLE_TEXT,
  DEFAULT_ADVANCED_TEMPLATE,
  DEFAULT_GENERATOR_CODE,
} from "../lib/constants";
import { Play, Lightning, StopCircle, GearSix, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";

const cfgInput =
  "bg-[#1E1E1E] border border-[#262626] text-white text-xs font-mono px-2 py-1.5 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] w-full";

export default function StressTester() {
  const [userCode, setUserCode] = useState(DEFAULT_USER_CPP);
  const [userLang, setUserLang] = useState("cpp");
  const [bruteCode, setBruteCode] = useState(DEFAULT_BRUTE_CPP);
  const [bruteLang, setBruteLang] = useState("cpp");

  const [mode, setMode] = useState("simple");
  const [simpleText, setSimpleText] = useState(DEFAULT_SIMPLE_TEXT);
  const [template, setTemplate] = useState(DEFAULT_ADVANCED_TEMPLATE);
  const [genCode, setGenCode] = useState(DEFAULT_GENERATOR_CODE);
  const [genLang, setGenLang] = useState("python");

  const [numTests, setNumTests] = useState(30);
  const [timeLimitMs, setTimeLimitMs] = useState(2000);
  const [memLimitMb, setMemLimitMb] = useState(256);
  const [stopOnFirstFail, setStopOnFirstFail] = useState(true);

  const [problem, setProblem] = useState("");
  const [aiOpen, setAiOpen] = useState(false);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [ceError, setCeError] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, phase: "" });
  const jobRef = useRef(null);
  const pollRef = useRef(null);
  const cancelledRef = useRef(false);

  const generator = () => {
    if (mode === "simple") return { mode: "simple", text: simpleText };
    if (mode === "advanced") return { mode: "advanced", template };
    return { mode: "code", language: genLang, code: genCode };
  };

  const poll = async () => {
    try {
      const s = await getRunStatus(jobRef.current);
      setProgress({ done: s.done, total: s.total, phase: s.phase });
      if (s.status === "running") {
        setResult({ status: "running", summary: s.summary, tests: s.tests });
        pollRef.current = setTimeout(poll, 300);
        return;
      }
      // terminal states
      if (s.status === "CE") {
        setCeError(s.ce);
        toast.error("Compilation Error", { description: `${s.ce.target} solution failed to compile` });
      } else if (s.status === "GEN_ERROR" || s.status === "error") {
        setResult({ status: s.status, message: s.message });
        toast.error("Error", { description: s.message });
      } else if (s.status === "cancelled") {
        setResult({ status: "cancelled", summary: s.summary, tests: s.tests });
        toast("Run cancelled", { description: `Stopped after ${s.done} test(s)` });
      } else {
        setResult({ status: "completed", summary: s.summary, tests: s.tests });
        if (s.summary.firstFail === null) toast.success(`All ${s.summary.total} tests passed`);
        else toast.error(`Failed at test #${s.summary.firstFail}`, { description: "Counterexample found" });
      }
      setRunning(false);
    } catch (e) {
      setRunning(false);
      toast.error("Run failed", { description: e?.message || "Server error" });
    }
  };

  const onRun = async () => {
    setRunning(true);
    setResult(null);
    setCeError(null);
    cancelledRef.current = false;
    const clamp = (v, lo, hi, d) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return d;
      return Math.min(hi, Math.max(lo, Math.round(n)));
    };
    const nt = clamp(numTests, 1, 5000, 30);
    const tl = clamp(timeLimitMs, 10, 60000, 2000);
    const mem = clamp(memLimitMb, 4, 8192, 256);
    setNumTests(nt);
    setTimeLimitMs(tl);
    setMemLimitMb(mem);
    setProgress({ done: 0, total: nt, phase: "queued" });
    try {
      const { jobId } = await startRun({
        userCode,
        userLang,
        bruteCode,
        bruteLang,
        generator: generator(),
        numTests: nt,
        timeLimitMs: tl,
        memLimitMb: mem,
        stopOnFirstFail,
      });
      jobRef.current = jobId;
      poll();
    } catch (e) {
      setRunning(false);
      toast.error("Run failed", { description: e?.response?.data?.detail || e?.message || "Server error" });
    }
  };

  const onCancel = async () => {
    if (!jobRef.current) return;
    cancelledRef.current = true;
    try {
      await cancelRun(jobRef.current);
    } catch (e) {
      /* ignore */
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-[#262626] flex items-center justify-between px-5 bg-[#0c0c0c]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-[#007AFF] flex items-center justify-center">
            <Lightning size={18} weight="fill" className="text-white" />
          </div>
          <div>
            <h1 className="font-display font-black text-base leading-none tracking-tight">
              STRESSLAB
            </h1>
            <p className="text-[10px] text-[#525252] uppercase tracking-[0.25em]">
              competitive stress tester
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="ai-assistant-btn"
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-2 border border-[#262626] hover:border-[#007AFF] hover:text-[#007AFF] text-[#A3A3A3] font-display font-bold uppercase tracking-widest text-xs px-4 h-9 rounded-sm transition-colors"
          >
            <Sparkle size={16} weight="fill" className="text-[#007AFF]" />
            AI
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                data-testid="settings-btn"
                className="flex items-center justify-center w-9 h-9 border border-[#262626] hover:border-[#007AFF] hover:text-[#007AFF] text-[#A3A3A3] rounded-sm transition-colors"
                title="Run settings"
              >
                <GearSix size={18} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              data-testid="settings-popover"
              className="bg-[#0c0c0c] border border-[#262626] text-white w-64 rounded-sm p-4"
            >
              <p className="font-display text-[10px] uppercase tracking-[0.2em] text-[#A3A3A3] mb-3">
                Run Config
              </p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="text-[9px] uppercase text-[#525252] tracking-wider">Tests</label>
                  <input data-testid="cfg-numtests" className={cfgInput} type="number" value={numTests} onChange={(e) => setNumTests(e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] uppercase text-[#525252] tracking-wider">Time ms</label>
                  <input data-testid="cfg-timelimit" className={cfgInput} type="number" value={timeLimitMs} onChange={(e) => setTimeLimitMs(e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] uppercase text-[#525252] tracking-wider">Mem MB</label>
                  <input data-testid="cfg-memlimit" className={cfgInput} type="number" value={memLimitMb} onChange={(e) => setMemLimitMb(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer" data-testid="cfg-stop-toggle">
                <input type="checkbox" checked={stopOnFirstFail} onChange={(e) => setStopOnFirstFail(e.target.checked)} className="accent-[#007AFF] w-3.5 h-3.5" />
                <span className="text-xs text-[#A3A3A3]">Stop on first failing test</span>
              </label>
              <p className="text-[10px] text-[#525252] mt-2 leading-relaxed">
                Tests 1–5000 · Time 10–60000 ms · Mem 4–8192 MB. Out-of-range values are adjusted automatically.
              </p>
            </PopoverContent>
          </Popover>

          {running ? (
            <button
              data-testid="cancel-stress-test-btn"
              onClick={onCancel}
              className="flex items-center gap-2 bg-[#FF3B30] hover:bg-white hover:text-[#050505] text-white font-display font-bold uppercase tracking-widest text-xs px-5 h-9 rounded-sm transition-colors active:scale-[0.98]"
            >
              <StopCircle size={16} weight="fill" />
              Cancel {progress.total ? `(${progress.done}/${progress.total})` : ""}
            </button>
          ) : (
            <button
              data-testid="run-stress-test-btn"
              onClick={onRun}
              className="flex items-center gap-2 bg-[#007AFF] hover:bg-white hover:text-[#050505] text-white font-display font-bold uppercase tracking-widest text-xs px-5 h-9 rounded-sm transition-colors active:scale-[0.98]"
            >
              <Play size={16} weight="fill" />
              Run Stress Test
            </button>
          )}
        </div>
      </header>

      {/* Body grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-px bg-[#262626] overflow-hidden">
        {/* Left: generator */}
        <div className="md:col-span-3 bg-[#050505] flex flex-col min-h-0 overflow-hidden">
          <GeneratorPanel
            mode={mode}
            setMode={setMode}
            simpleText={simpleText}
            setSimpleText={setSimpleText}
            template={template}
            setTemplate={setTemplate}
            genCode={genCode}
            setGenCode={setGenCode}
            genLang={genLang}
            setGenLang={setGenLang}
          />
        </div>

        {/* Middle: editors */}
        <div className="md:col-span-5 bg-[#050505] flex flex-col min-h-0 overflow-hidden">
          <CodeEditor
            title="Your Solution"
            testid="user-editor"
            lang={userLang}
            onLangChange={setUserLang}
            value={userCode}
            onChange={setUserCode}
          />
          <div className="h-px bg-[#262626] shrink-0" />
          <CodeEditor
            title="Correct / Brute Solution"
            testid="brute-editor"
            lang={bruteLang}
            onLangChange={setBruteLang}
            value={bruteCode}
            onChange={setBruteCode}
          />
        </div>

        {/* Right: results */}
        <div className="md:col-span-4 bg-[#050505] min-h-0 overflow-hidden">
          <ResultsPanel
            result={result}
            running={running}
            ceError={ceError}
            progress={progress}
            problem={problem}
            userCode={userCode}
            userLang={userLang}
          />
        </div>
      </div>

      <AIAssistant
        open={aiOpen}
        onOpenChange={setAiOpen}
        problem={problem}
        setProblem={setProblem}
        setUserCode={setUserCode}
        setBruteCode={setBruteCode}
        setBruteLang={setBruteLang}
        setUserLang={setUserLang}
        setTemplate={setTemplate}
        setMode={setMode}
      />
    </div>
  );
}
