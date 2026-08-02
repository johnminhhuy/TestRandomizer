import React, { useState } from "react";
import { VERDICTS } from "../lib/constants";
import { Warning, CheckCircle, Cpu, Clock, CircleNotch, StopCircle, Sparkle, Lightbulb } from "@phosphor-icons/react";
import { aiExplain } from "../lib/apiClient";
import { toast } from "sonner";

const Badge = ({ v, size = "sm" }) => {
  const info = VERDICTS[v] || VERDICTS.ERR;
  return (
    <span
      data-testid={`verdict-badge-${v}`}
      className={`inline-flex items-center justify-center font-mono font-bold rounded-sm ${
        size === "lg" ? "text-sm px-2.5 py-1" : "text-[10px] px-1.5 py-0.5"
      }`}
      style={{ color: info.color, backgroundColor: info.color + "26", border: `1px solid ${info.color}55` }}
    >
      {info.label}
    </span>
  );
};

const Diff = ({ expected, output }) => {
  const eLines = (expected || "").split("\n");
  const oLines = (output || "").split("\n");
  const max = Math.max(eLines.length, oLines.length);
  const rows = [];
  for (let i = 0; i < max; i++) {
    const e = eLines[i] ?? "";
    const o = oLines[i] ?? "";
    rows.push({ e, o, diff: e.trim() !== o.trim() });
  }
  return (
    <div className="grid grid-cols-2 gap-px bg-[#262626] rounded-sm overflow-hidden text-xs font-mono">
      <div className="bg-[#0c0c0c]">
        <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-[#22C55E] border-b border-[#262626]">
          Expected
        </div>
        <div className="max-h-48 overflow-auto">
          {rows.map((r, i) => (
            <div key={i} className={`px-2 py-0.5 whitespace-pre-wrap ${r.diff ? "bg-[#22C55E]/10" : ""}`}>
              {r.e || " "}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#0c0c0c]">
        <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-[#EF4444] border-b border-[#262626]">
          Your Output
        </div>
        <div className="max-h-48 overflow-auto">
          {rows.map((r, i) => (
            <div key={i} className={`px-2 py-0.5 whitespace-pre-wrap ${r.diff ? "bg-[#EF4444]/10" : ""}`}>
              {r.o || " "}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TestDetail = ({ t, problem, userCode, userLang }) => {
  const [loading, setLoading] = useState(false);
  const [explain, setExplain] = useState(null);

  const onExplain = async () => {
    setLoading(true);
    try {
      const res = await aiExplain({
        problem: problem || "",
        language: userLang,
        code: userCode,
        input: t.input || "",
        expected: t.expected || "",
        output: t.output || "",
      });
      setExplain(res);
    } catch (e) {
      toast.error("AI explain failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-[#262626] p-3 space-y-3 bg-[#050505]" data-testid={`test-detail-${t.index}`}>
      {t.note && <div className="text-xs text-[#A3A3A3]">{t.note}</div>}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[#A3A3A3] mb-1">Input</div>
        <pre className="bg-[#0c0c0c] border border-[#262626] rounded-sm p-2 text-xs font-mono max-h-32 overflow-auto whitespace-pre-wrap text-white">
          {t.input || "(empty)"}
        </pre>
      </div>
      {(t.expected !== undefined || t.output !== undefined) && (
        <Diff expected={t.expected} output={t.output} />
      )}
      {t.stderr && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#D946EF] mb-1">stderr</div>
          <pre className="bg-[#0c0c0c] border border-[#262626] rounded-sm p-2 text-xs font-mono max-h-28 overflow-auto whitespace-pre-wrap text-[#D946EF]">
            {t.stderr}
          </pre>
        </div>
      )}
      {t.input && (
        <button
          data-testid={`explain-btn-${t.index}`}
          onClick={onExplain}
          disabled={loading}
          className="flex items-center gap-2 w-full justify-center border border-[#007AFF]/50 text-[#007AFF] hover:bg-[#007AFF] hover:text-white font-display font-bold uppercase tracking-widest text-[11px] px-3 h-8 rounded-sm transition-colors disabled:opacity-40"
        >
          {loading ? <CircleNotch size={14} className="animate-spin" /> : <Sparkle size={14} weight="fill" />}
          {loading ? "Analyzing..." : "Explain with AI"}
        </button>
      )}
      {explain && (
        <div data-testid={`explain-result-${t.index}`} className="space-y-2">
          <div className="border border-[#EF4444]/40 bg-[#EF4444]/10 rounded-sm p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#EF4444] mb-1">
              <Warning size={12} /> Diagnosis
            </div>
            <p className="text-xs text-[#f3c9c9] leading-relaxed">{explain.diagnosis}</p>
          </div>
          <div className="border border-[#22C55E]/40 bg-[#22C55E]/10 rounded-sm p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#22C55E] mb-1">
              <Lightbulb size={12} /> Hint
            </div>
            <p className="text-xs text-[#c9f3d5] leading-relaxed">{explain.hint}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ running }) => (
  <div className="h-full flex flex-col items-center justify-center text-center p-8" data-testid="results-empty">
    <div className="w-14 h-14 rounded-sm border border-[#262626] flex items-center justify-center mb-4">
      <Cpu size={26} className="text-[#525252]" />
    </div>
    <p className="text-sm text-[#A3A3A3] font-display uppercase tracking-widest">
      {running ? "Running tests..." : "No results yet"}
    </p>
    <p className="text-xs text-[#525252] mt-2 max-w-[240px]">
      {running
        ? "Compiling and stress-testing your solution against the reference."
        : "Configure your generator, paste both solutions, then run the stress test."}
    </p>
  </div>
);

export const ResultsPanel = ({ result, running, ceError, progress, problem, userCode, userLang }) => {
  const [openIdx, setOpenIdx] = useState(null);

  if (ceError) {
    return (
      <div className="p-4" data-testid="ce-error">
        <div className="flex items-center gap-2 mb-3">
          <Badge v="CE" size="lg" />
          <span className="text-sm text-white font-display uppercase tracking-widest">
            {ceError.target} solution
          </span>
        </div>
        <pre className="bg-[#0c0c0c] border border-[#06B6D4]/40 rounded-sm p-3 text-xs font-mono text-[#06B6D4] whitespace-pre-wrap max-h-[70vh] overflow-auto">
          {ceError.message}
        </pre>
      </div>
    );
  }

  if (result && (result.status === "GEN_ERROR" || result.status === "error")) {
    return (
      <div className="p-4" data-testid="gen-error">
        <div className="flex items-center gap-2 mb-3">
          <Warning size={20} className="text-[#EF4444]" />
          <span className="text-sm text-white font-display uppercase tracking-widest">
            {result.status === "GEN_ERROR" ? "Generator Error" : "Error"}
          </span>
        </div>
        <pre className="bg-[#0c0c0c] border border-[#EF4444]/40 rounded-sm p-3 text-xs font-mono text-[#EF4444] whitespace-pre-wrap">
          {result.message}
        </pre>
      </div>
    );
  }

  if (!result) return <EmptyState running={running} />;

  const isRunning = running || result.status === "running";
  const { summary, tests } = result;
  const allPass = summary.firstFail === null;
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const phaseLabel =
    progress?.phase === "compiling"
      ? "Compiling solutions..."
      : progress?.phase === "running"
      ? `Running test ${progress.done}/${progress.total}`
      : progress?.phase === "queued"
      ? "Starting..."
      : "";

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="results-panel">
      <div className="p-4 border-b border-[#262626] shrink-0">
        {isRunning ? (
          <div data-testid="run-progress">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-display uppercase tracking-widest text-white flex items-center gap-2">
                <CircleNotch size={16} className="animate-spin text-[#007AFF]" />
                {phaseLabel}
              </span>
              <span className="font-mono text-xs text-[#A3A3A3]">{pct}%</span>
            </div>
            <div className="h-1.5 bg-[#1E1E1E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#007AFF] transition-all duration-300"
                style={{ width: `${progress?.phase === "compiling" ? 8 : pct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-3">
            {result.status === "cancelled" ? (
              <>
                <StopCircle size={20} weight="fill" className="text-[#A3A3A3]" />
                <span className="text-sm font-display uppercase tracking-widest text-white">
                  Cancelled · {summary.total} test(s) run
                </span>
              </>
            ) : allPass ? (
              <>
                <CheckCircle size={20} weight="fill" className="text-[#22C55E]" />
                <span className="text-sm font-display uppercase tracking-widest text-white">
                  All {summary.total} tests passed
                </span>
              </>
            ) : (
              <>
                <Warning size={20} weight="fill" className="text-[#EF4444]" />
                <span className="text-sm font-display uppercase tracking-widest text-white">
                  Failed at test #{summary.firstFail}
                </span>
              </>
            )}
          </div>
        )}
        {tests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3" data-testid="summary-counts">
            {Object.entries(summary.counts)
              .filter(([, c]) => c > 0)
              .map(([v, c]) => (
                <div key={v} className="flex items-center gap-1">
                  <Badge v={v} />
                  <span className="text-xs font-mono text-[#A3A3A3]">{c}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" data-testid="test-list">
        {tests.map((t) => (
          <div key={t.index} className="border-b border-[#262626]">
            <button
              data-testid={`test-row-${t.index}`}
              onClick={() => setOpenIdx(openIdx === t.index ? null : t.index)}
              disabled={t.verdict === "AC"}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                t.verdict === "AC" ? "cursor-default" : "hover:bg-[#1E1E1E]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[#525252] w-8">#{t.index}</span>
                <Badge v={t.verdict} />
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-[#A3A3A3]">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {t.time_ms}ms
                </span>
                <span className="flex items-center gap-1">
                  <Cpu size={12} /> {(t.mem_kb / 1024).toFixed(1)}MB
                </span>
              </div>
            </button>
            {openIdx === t.index && t.verdict !== "AC" && (
              <TestDetail t={t} problem={problem} userCode={userCode} userLang={userLang} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
