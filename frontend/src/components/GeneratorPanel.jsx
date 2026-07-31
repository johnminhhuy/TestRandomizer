import React, { useState } from "react";
import { Plus, Trash, Eye, Sparkle } from "@phosphor-icons/react";
import { previewGenerator } from "../lib/apiClient";
import { toast } from "sonner";

const inputCls =
  "bg-[#1E1E1E] border border-[#262626] text-white text-xs font-mono px-2 py-1.5 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] w-full";

const SimpleBuilder = ({ cfg, setCfg }) => {
  const updateVar = (i, key, val) => {
    const variables = cfg.variables.map((v, idx) => (idx === i ? { ...v, [key]: val } : v));
    setCfg({ ...cfg, variables });
  };
  const addVar = () =>
    setCfg({ ...cfg, variables: [...cfg.variables, { name: "x", min: "1", max: "100" }] });
  const removeVar = (i) =>
    setCfg({ ...cfg, variables: cfg.variables.filter((_, idx) => idx !== i) });

  const updateLine = (i, patch) => {
    const lines = cfg.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    setCfg({ ...cfg, lines });
  };
  const addLine = (kind) => {
    const base =
      kind === "vars"
        ? { kind: "vars", vars: cfg.variables[0] ? [cfg.variables[0].name] : [] }
        : kind === "array"
        ? { kind: "array", count: cfg.variables[0]?.name || "5", min: "1", max: "100" }
        : { kind: "const", text: "" };
    setCfg({ ...cfg, lines: [...cfg.lines, base] });
  };
  const removeLine = (i) => setCfg({ ...cfg, lines: cfg.lines.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4" data-testid="simple-builder">
      <div>
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-[#A3A3A3] mb-2">
          Variables
        </p>
        <div className="space-y-2">
          {cfg.variables.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5" data-testid={`var-row-${i}`}>
              <input
                className={inputCls + " w-16"}
                value={v.name}
                onChange={(e) => updateVar(i, "name", e.target.value)}
                placeholder="name"
              />
              <span className="text-[#525252] text-xs">∈ [</span>
              <input
                className={inputCls + " w-16"}
                value={v.min}
                onChange={(e) => updateVar(i, "min", e.target.value)}
                placeholder="min"
              />
              <input
                className={inputCls + " w-16"}
                value={v.max}
                onChange={(e) => updateVar(i, "max", e.target.value)}
                placeholder="max"
              />
              <span className="text-[#525252] text-xs">]</span>
              <button
                data-testid={`remove-var-${i}`}
                onClick={() => removeVar(i)}
                className="text-[#525252] hover:text-[#EF4444] p-1"
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          data-testid="add-var-btn"
          onClick={addVar}
          className="mt-2 flex items-center gap-1 text-[11px] text-[#007AFF] hover:text-white"
        >
          <Plus size={12} /> add variable
        </button>
      </div>

      <div>
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-[#A3A3A3] mb-2">
          Output Lines
        </p>
        <div className="space-y-2">
          {cfg.lines.map((l, i) => (
            <div
              key={i}
              className="border border-[#262626] rounded-sm p-2 bg-[#0c0c0c]"
              data-testid={`line-row-${i}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] uppercase text-[#EAB308]">{l.kind}</span>
                <button
                  data-testid={`remove-line-${i}`}
                  onClick={() => removeLine(i)}
                  className="text-[#525252] hover:text-[#EF4444]"
                >
                  <Trash size={13} />
                </button>
              </div>
              {l.kind === "vars" && (
                <input
                  className={inputCls}
                  value={l.vars.join(", ")}
                  onChange={(e) =>
                    updateLine(i, { vars: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                  }
                  placeholder="n, m"
                />
              )}
              {l.kind === "array" && (
                <div className="flex items-center gap-1.5">
                  <input className={inputCls + " w-20"} value={l.count} onChange={(e) => updateLine(i, { count: e.target.value })} placeholder="count" />
                  <span className="text-[#525252] text-xs">×[</span>
                  <input className={inputCls + " w-16"} value={l.min} onChange={(e) => updateLine(i, { min: e.target.value })} placeholder="min" />
                  <input className={inputCls + " w-16"} value={l.max} onChange={(e) => updateLine(i, { max: e.target.value })} placeholder="max" />
                  <span className="text-[#525252] text-xs">]</span>
                </div>
              )}
              {l.kind === "const" && (
                <input className={inputCls} value={l.text} onChange={(e) => updateLine(i, { text: e.target.value })} placeholder="literal text" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {["vars", "array", "const"].map((k) => (
            <button
              key={k}
              data-testid={`add-line-${k}`}
              onClick={() => addLine(k)}
              className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:text-white"
            >
              <Plus size={12} /> {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const GeneratorPanel = ({ mode, setMode, simpleCfg, setSimpleCfg, template, setTemplate }) => {
  const [preview, setPreview] = useState("");
  const [previewErr, setPreviewErr] = useState("");
  const [loading, setLoading] = useState(false);

  const buildGenerator = () =>
    mode === "simple" ? { ...simpleCfg, mode: "simple" } : { mode: "advanced", template };

  const doPreview = async () => {
    setLoading(true);
    setPreviewErr("");
    try {
      const res = await previewGenerator(buildGenerator());
      if (res.ok) {
        setPreview(res.input);
      } else {
        setPreviewErr(res.error);
        setPreview("");
        toast.error("Generator error", { description: res.error });
      }
    } catch (e) {
      setPreviewErr("Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="generator-panel">
      <div className="flex border-b border-[#262626] shrink-0">
        {[
          { id: "simple", label: "Simple" },
          { id: "advanced", label: "Advanced" },
        ].map((t) => (
          <button
            key={t.id}
            data-testid={`gen-tab-${t.id}`}
            onClick={() => setMode(t.id)}
            className={`px-4 h-10 text-xs uppercase tracking-widest border-b-2 transition-colors ${
              mode === t.id
                ? "border-[#007AFF] text-white"
                : "border-transparent text-[#A3A3A3] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {mode === "simple" ? (
          <SimpleBuilder cfg={simpleCfg} setCfg={setSimpleCfg} />
        ) : (
          <div data-testid="advanced-builder">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-[#A3A3A3] mb-2">
              Template DSL
            </p>
            <textarea
              data-testid="advanced-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              spellCheck={false}
              className="w-full h-56 bg-[#1E1E1E] border border-[#262626] text-white text-xs font-mono p-3 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] resize-none"
            />
            <div className="mt-2 text-[10px] text-[#525252] font-mono leading-relaxed">
              <div>name = int(lo, hi)</div>
              <div>print(expr, ...) · array(count, lo, hi)</div>
              <div>grid(rows, cols, lo, hi) · blank</div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#262626] shrink-0">
        <div className="flex items-center justify-between px-4 h-9">
          <span className="font-display text-[10px] uppercase tracking-[0.2em] text-[#A3A3A3]">
            Preview
          </span>
          <button
            data-testid="preview-btn"
            onClick={doPreview}
            disabled={loading}
            className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:text-white disabled:opacity-40"
          >
            <Eye size={13} /> {loading ? "..." : "generate"}
          </button>
        </div>
        <pre
          data-testid="preview-output"
          className={`px-4 pb-3 max-h-28 overflow-auto text-xs font-mono whitespace-pre-wrap ${
            previewErr ? "text-[#EF4444]" : "text-[#22C55E]"
          }`}
        >
          {previewErr || preview || "click generate to preview a test case"}
        </pre>
      </div>
    </div>
  );
};
