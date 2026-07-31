import React, { useState } from "react";
import { Plus, Trash, Eye } from "@phosphor-icons/react";
import { previewGenerator } from "../lib/apiClient";
import { toast } from "sonner";

const inputCls =
  "bg-[#1E1E1E] border border-[#262626] text-white text-xs font-mono px-2 py-1.5 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF]";

const TYPES = [
  { id: "int", label: "int" },
  { id: "float", label: "float" },
  { id: "char", label: "char" },
  { id: "string", label: "string" },
];

const TypeSelect = ({ value, onChange, testid }) => (
  <select
    data-testid={testid}
    value={value || "int"}
    onChange={(e) => onChange(e.target.value)}
    className="bg-[#1E1E1E] border border-[#262626] text-[#EAB308] text-[10px] font-mono px-1.5 py-1 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] cursor-pointer uppercase"
  >
    {TYPES.map((t) => (
      <option key={t.id} value={t.id}>{t.label}</option>
    ))}
  </select>
);

// Renders the constraint inputs for a typed spec (used by both vars and arrays)
const Constraints = ({ spec, patch, prefix }) => {
  const t = spec.type || "int";
  if (t === "int" || t === "float") {
    return (
      <>
        <span className="text-[#525252] text-xs">[</span>
        <input data-testid={`${prefix}-min`} className={inputCls + " w-16"} value={spec.min ?? ""} onChange={(e) => patch({ min: e.target.value })} placeholder="min" />
        <input data-testid={`${prefix}-max`} className={inputCls + " w-16"} value={spec.max ?? ""} onChange={(e) => patch({ max: e.target.value })} placeholder="max" />
        <span className="text-[#525252] text-xs">]</span>
        {t === "float" && (
          <input data-testid={`${prefix}-decimals`} className={inputCls + " w-14"} value={spec.decimals ?? "2"} onChange={(e) => patch({ decimals: e.target.value })} placeholder="dec" title="decimals" />
        )}
      </>
    );
  }
  if (t === "char") {
    return (
      <input data-testid={`${prefix}-charset`} className={inputCls + " w-full"} value={spec.charset ?? "a-z"} onChange={(e) => patch({ charset: e.target.value })} placeholder="charset e.g. a-z" />
    );
  }
  // string
  return (
    <>
      <input data-testid={`${prefix}-charset`} className={inputCls + " flex-1 min-w-[120px]"} value={spec.charset ?? "a-z"} onChange={(e) => patch({ charset: e.target.value })} placeholder="charset e.g. a-z" />
      <input data-testid={`${prefix}-len`} className={inputCls + " w-20"} value={spec.len ?? "5"} onChange={(e) => patch({ len: e.target.value })} placeholder="len" />
    </>
  );
};

const SimpleBuilder = ({ cfg, setCfg }) => {
  const updateVar = (i, patch) => {
    const variables = cfg.variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v));
    setCfg({ ...cfg, variables });
  };
  const addVar = () =>
    setCfg({ ...cfg, variables: [...cfg.variables, { name: "x", type: "int", min: "1", max: "100" }] });
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
        ? { kind: "array", count: cfg.variables[0]?.name || "5", type: "int", min: "1", max: "100", distinct: false }
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
            <div key={i} className="border border-[#262626] rounded-sm p-2 bg-[#0c0c0c] space-y-1.5" data-testid={`var-row-${i}`}>
              <div className="flex items-center gap-1.5">
                <input
                  className={inputCls + " w-20"}
                  value={v.name}
                  onChange={(e) => updateVar(i, { name: e.target.value })}
                  placeholder="name"
                  data-testid={`var-name-${i}`}
                />
                <TypeSelect testid={`var-type-${i}`} value={v.type} onChange={(val) => updateVar(i, { type: val })} />
                <div className="flex-1" />
                <button data-testid={`remove-var-${i}`} onClick={() => removeVar(i)} className="text-[#525252] hover:text-[#EF4444] p-1">
                  <Trash size={14} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Constraints spec={v} prefix={`var-${i}`} patch={(p) => updateVar(i, p)} />
              </div>
            </div>
          ))}
        </div>
        <button data-testid="add-var-btn" onClick={addVar} className="mt-2 flex items-center gap-1 text-[11px] text-[#007AFF] hover:text-white">
          <Plus size={12} /> add variable
        </button>
      </div>

      <div>
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-[#A3A3A3] mb-2">
          Output Lines
        </p>
        <div className="space-y-2">
          {cfg.lines.map((l, i) => (
            <div key={i} className="border border-[#262626] rounded-sm p-2 bg-[#0c0c0c]" data-testid={`line-row-${i}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] uppercase text-[#EAB308]">{l.kind}</span>
                <button data-testid={`remove-line-${i}`} onClick={() => removeLine(i)} className="text-[#525252] hover:text-[#EF4444]">
                  <Trash size={13} />
                </button>
              </div>
              {l.kind === "vars" && (
                <input
                  className={inputCls + " w-full"}
                  value={l.vars.join(", ")}
                  onChange={(e) => updateLine(i, { vars: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="n, m"
                />
              )}
              {l.kind === "array" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#525252] uppercase">count</span>
                    <input className={inputCls + " w-24"} value={l.count} onChange={(e) => updateLine(i, { count: e.target.value })} placeholder="count" data-testid={`line-${i}-count`} />
                    <TypeSelect testid={`line-type-${i}`} value={l.type} onChange={(val) => updateLine(i, { type: val })} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Constraints spec={l} prefix={`line-${i}`} patch={(p) => updateLine(i, p)} />
                  </div>
                  {(l.type || "int") === "int" && (
                    <label className="flex items-center gap-1.5 cursor-pointer" data-testid={`line-${i}-distinct`}>
                      <input type="checkbox" checked={!!l.distinct} onChange={(e) => updateLine(i, { distinct: e.target.checked })} className="accent-[#007AFF] w-3 h-3" />
                      <span className="text-[10px] text-[#A3A3A3]">distinct values</span>
                    </label>
                  )}
                </div>
              )}
              {l.kind === "const" && (
                <input className={inputCls + " w-full"} value={l.text} onChange={(e) => updateLine(i, { text: e.target.value })} placeholder="literal text" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {["vars", "array", "const"].map((k) => (
            <button key={k} data-testid={`add-line-${k}`} onClick={() => addLine(k)} className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:text-white">
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
