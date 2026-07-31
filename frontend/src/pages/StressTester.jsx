import React, { useState } from "react";
import { CodeEditor } from "../components/CodeEditor";
import { GeneratorPanel } from "../components/GeneratorPanel";
import { ResultsPanel } from "../components/ResultsPanel";
import { runStress } from "../lib/apiClient";
import {
  DEFAULT_USER_CPP,
  DEFAULT_BRUTE_CPP,
  DEFAULT_SIMPLE,
  DEFAULT_ADVANCED_TEMPLATE,
} from "../lib/constants";
import { Play, Lightning, CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";

const cfgInput =
  "bg-[#1E1E1E] border border-[#262626] text-white text-xs font-mono px-2 py-1.5 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] w-full";

export default function StressTester() {
  const [userCode, setUserCode] = useState(DEFAULT_USER_CPP);
  const [userLang, setUserLang] = useState("cpp");
  const [bruteCode, setBruteCode] = useState(DEFAULT_BRUTE_CPP);
  const [bruteLang, setBruteLang] = useState("cpp");

  const [mode, setMode] = useState("simple");
  const [simpleCfg, setSimpleCfg] = useState(DEFAULT_SIMPLE);
  const [template, setTemplate] = useState(DEFAULT_ADVANCED_TEMPLATE);

  const [numTests, setNumTests] = useState(30);
  const [timeLimitMs, setTimeLimitMs] = useState(2000);
  const [memLimitMb, setMemLimitMb] = useState(256);
  const [stopOnFirstFail, setStopOnFirstFail] = useState(true);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [ceError, setCeError] = useState(null);

  const generator = () =>
    mode === "simple" ? { ...simpleCfg, mode: "simple" } : { mode: "advanced", template };

  const onRun = async () => {
    setRunning(true);
    setResult(null);
    setCeError(null);
    try {
      const data = await runStress({
        userCode,
        userLang,
        bruteCode,
        bruteLang,
        generator: generator(),
        numTests: Number(numTests),
        timeLimitMs: Number(timeLimitMs),
        memLimitMb: Number(memLimitMb),
        stopOnFirstFail,
      });
      if (data.status === "CE") {
        setCeError(data.ce);
        toast.error("Compilation Error", { description: `${data.ce.target} solution failed to compile` });
      } else {
        setResult(data);
        if (data.status === "completed") {
          if (data.summary.firstFail === null) {
            toast.success(`All ${data.summary.total} tests passed`);
          } else {
            toast.error(`Failed at test #${data.summary.firstFail}`, {
              description: "Counterexample found",
            });
          }
        }
      }
    } catch (e) {
      toast.error("Run failed", { description: e?.message || "Server error" });
    } finally {
      setRunning(false);
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
        <button
          data-testid="run-stress-test-btn"
          onClick={onRun}
          disabled={running}
          className="flex items-center gap-2 bg-[#007AFF] hover:bg-white hover:text-[#050505] text-white font-display font-bold uppercase tracking-widest text-xs px-5 h-9 rounded-sm transition-colors active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-[#007AFF] disabled:hover:text-white"
        >
          {running ? <CircleNotch size={16} className="animate-spin" /> : <Play size={16} weight="fill" />}
          {running ? "Running" : "Run Stress Test"}
        </button>
      </header>

      {/* Body grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-px bg-[#262626] overflow-hidden">
        {/* Left: generator + config */}
        <div className="md:col-span-3 bg-[#050505] flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <GeneratorPanel
              mode={mode}
              setMode={setMode}
              simpleCfg={simpleCfg}
              setSimpleCfg={setSimpleCfg}
              template={template}
              setTemplate={setTemplate}
            />
          </div>
          <div className="border-t border-[#262626] p-4 shrink-0" data-testid="config-panel">
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
          </div>
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
          <ResultsPanel result={result} running={running} ceError={ceError} />
        </div>
      </div>
    </div>
  );
}
