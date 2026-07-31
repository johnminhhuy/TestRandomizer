import React, { useState } from "react";
import { VERDICTS } from "../lib/constants";
import { Warning, CheckCircle, Cpu, Clock } from "@phosphor-icons/react";

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

const TestDetail = ({ t }) => (
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
  </div>
);

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

export const ResultsPanel = ({ result, running, ceError }) => {
  const [openIdx, setOpenIdx] = useState(null);

  if (running && !result) return <EmptyState running />;

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

  if (!result) return <EmptyState running={false} />;

  if (result.status === "GEN_ERROR") {
    return (
      <div className="p-4" data-testid="gen-error">
        <div className="flex items-center gap-2 mb-3">
          <Warning size={20} className="text-[#EF4444]" />
          <span className="text-sm text-white font-display uppercase tracking-widest">Generator Error</span>
        </div>
        <pre className="bg-[#0c0c0c] border border-[#EF4444]/40 rounded-sm p-3 text-xs font-mono text-[#EF4444] whitespace-pre-wrap">
          {result.message}
        </pre>
      </div>
    );
  }

  const { summary, tests } = result;
  const allPass = summary.firstFail === null;

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="results-panel">
      <div className="p-4 border-b border-[#262626] shrink-0">
        <div className="flex items-center gap-2 mb-3">
          {allPass ? (
            <CheckCircle size={20} weight="fill" className="text-[#22C55E]" />
          ) : (
            <Warning size={20} weight="fill" className="text-[#EF4444]" />
          )}
          <span className="text-sm font-display uppercase tracking-widest text-white">
            {allPass ? `All ${summary.total} tests passed` : `Failed at test #${summary.firstFail}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="summary-counts">
          {Object.entries(summary.counts)
            .filter(([, c]) => c > 0)
            .map(([v, c]) => (
              <div key={v} className="flex items-center gap-1">
                <Badge v={v} />
                <span className="text-xs font-mono text-[#A3A3A3]">{c}</span>
              </div>
            ))}
        </div>
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
            {openIdx === t.index && t.verdict !== "AC" && <TestDetail t={t} />}
          </div>
        ))}
      </div>
    </div>
  );
};
