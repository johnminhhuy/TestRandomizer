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

const LINE_KINDS = [
  { id: "vars", label: "Print values" },
  { id: "array", label: "Random list" },
  { id: "const", label: "Fixed text" },
];

const defaultLine = (kind, cfg) => {
  if (kind === "vars")
    return { kind: "vars", vars: cfg.variables[0] ? [cfg.variables[0].name] : [] };
  if (kind === "array")
    return { kind: "array", count: cfg.variables[0]?.name || "5", type: "int", min: "1", max: "100", distinct: false };
  return { kind: "const", text: "" };
};

const describeVar = (v) => {
  const nm = v.name || "?";
  const t = v.type || "int";
  if (t === "int") return `${nm} = a whole number from ${v.min} to ${v.max}`;
  if (t === "float") return `${nm} = a decimal from ${v.min} to ${v.max} (${v.decimals ?? 2} dp)`;
  if (t === "char") return `${nm} = one character from "${v.charset ?? "a-z"}"`;
  return `${nm} = text of length ${v.len ?? 5} from "${v.charset ?? "a-z"}"`;
};

const describeLine = (l) => {
  if (l.kind === "vars")
    return (l.vars && l.vars.length)
      ? `Writes one line:  ${l.vars.join(" ")}`
      : "Pick which values to print on this line ↓";
  if (l.kind === "const")
    return l.text ? `Writes the exact text:  ${l.text}` : "Writes a fixed line of text ↓";
  const c = l.count || "?";
  const t = l.type || "int";
  if (t === "int")
    return `Writes ${c} ${l.distinct ? "distinct " : ""}whole numbers between ${l.min} and ${l.max} on one line`;
  if (t === "float")
    return `Writes ${c} decimals between ${l.min} and ${l.max} on one line`;
  if (t === "char")
    return `Writes ${c} characters from "${l.charset ?? "a-z"}" on one line`;
  return `Writes ${c} strings from "${l.charset ?? "a-z"}" on one line`;
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
    setCfg({ ...cfg, lines: [...cfg.lines, defaultLine(kind, cfg)] });
  };
  const changeLineKind = (i, kind) => {
    const lines = cfg.lines.map((l, idx) => (idx === i ? defaultLine(kind, cfg) : l));
    setCfg({ ...cfg, lines });
  };
  const toggleVarInLine = (i, name) => {
    const l = cfg.lines[i];
    const has = (l.vars || []).includes(name);
    const vars = has ? l.vars.filter((x) => x !== name) : [...(l.vars || []), name];
    updateLine(i, { vars });
  };
  const removeLine = (i) => setCfg({ ...cfg, lines: cfg.lines.filter((_, idx) => idx !== i) });

  const varNames = cfg.variables.map((v) => v.name).filter(Boolean);

  return (
    <div className="space-y-5" data-testid="simple-builder">
      <div className="text-[11px] text-[#A3A3A3] leading-relaxed border border-[#262626] bg-[#0c0c0c] rounded-sm p-3">
        Build the input your program reads, top to bottom.
        <span className="block mt-1 text-[#525252]">
          <b className="text-[#A3A3A3]">Step 1</b> — define reusable numbers (e.g. <code className="text-[#EAB308]">n</code> = array size).
          <b className="text-[#A3A3A3]"> Step 2</b> — add output lines that get written.
        </span>
      </div>

      {/* Step 1: variables */}
      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-display text-xs font-black text-[#007AFF]">1</span>
          <p className="font-display text-[11px] uppercase tracking-[0.2em] text-white">Variables</p>
        </div>
        <p className="text-[10px] text-[#525252] mb-2">Named values you can reuse below. Optional.</p>
        <div className="space-y-2">
          {cfg.variables.map((v, i) => (
            <div key={i} className="border border-[#262626] rounded-sm p-2.5 bg-[#0c0c0c] space-y-1.5" data-testid={`var-row-${i}`}>
              <div className="flex items-center gap-1.5">
                <input
                  className={inputCls + " w-20"}
                  value={v.name}
                  onChange={(e) => updateVar(i, { name: e.target.value })}
                  placeholder="name"
                  data-testid={`var-name-${i}`}
                />
                <span className="text-[10px] text-[#525252] lowercase">is a</span>
                <TypeSelect testid={`var-type-${i}`} value={v.type} onChange={(val) => updateVar(i, { type: val })} />
                <div className="flex-1" />
                <button data-testid={`remove-var-${i}`} onClick={() => removeVar(i)} className="text-[#525252] hover:text-[#EF4444] p-1">
                  <Trash size={14} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-[#525252] lowercase">range</span>
                <Constraints spec={v} prefix={`var-${i}`} patch={(p) => updateVar(i, p)} />
              </div>
              <p className="text-[10px] text-[#22C55E] font-mono pt-0.5">↳ {describeVar(v)}</p>
            </div>
          ))}
        </div>
        <button data-testid="add-var-btn" onClick={addVar} className="mt-2 flex items-center gap-1 text-[11px] text-[#007AFF] hover:text-white">
          <Plus size={12} /> add variable
        </button>
      </div>

      {/* Step 2: output lines */}
      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-display text-xs font-black text-[#007AFF]">2</span>
          <p className="font-display text-[11px] uppercase tracking-[0.2em] text-white">Output lines</p>
        </div>
        <p className="text-[10px] text-[#525252] mb-2">Each row becomes one line of your program's input, in order.</p>
        <div className="space-y-2">
          {cfg.lines.map((l, i) => (
            <div key={i} className="border border-[#262626] rounded-sm p-2.5 bg-[#0c0c0c] space-y-2" data-testid={`line-row-${i}`}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[#525252]">line {i + 1}</span>
                <select
                  data-testid={`line-kind-${i}`}
                  value={l.kind}
                  onChange={(e) => changeLineKind(i, e.target.value)}
                  className="bg-[#1E1E1E] border border-[#262626] text-white text-[11px] px-2 py-1 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] cursor-pointer"
                >
                  {LINE_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
                <div className="flex-1" />
                <button data-testid={`remove-line-${i}`} onClick={() => removeLine(i)} className="text-[#525252] hover:text-[#EF4444]">
                  <Trash size={13} />
                </button>
              </div>

              {l.kind === "vars" && (
                <div className="space-y-1.5">
                  {varNames.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {varNames.map((nm) => {
                        const active = (l.vars || []).includes(nm);
                        return (
                          <button
                            key={nm}
                            data-testid={`line-${i}-chip-${nm}`}
                            onClick={() => toggleVarInLine(i, nm)}
                            className={`text-[11px] font-mono px-2 py-0.5 rounded-sm border transition-colors ${
                              active
                                ? "bg-[#007AFF] border-[#007AFF] text-white"
                                : "bg-transparent border-[#262626] text-[#A3A3A3] hover:border-[#007AFF]"
                            }`}
                          >
                            {nm}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <input
                    className={inputCls + " w-full"}
                    value={(l.vars || []).join(", ")}
                    onChange={(e) => updateLine(i, { vars: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    placeholder="click a variable above, or type: n, m"
                  />
                </div>
              )}

              {l.kind === "array" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-[#525252] lowercase">how many</span>
                    <input className={inputCls + " w-24"} value={l.count} onChange={(e) => updateLine(i, { count: e.target.value })} placeholder="e.g. n" data-testid={`line-${i}-count`} />
                    <span className="text-[10px] text-[#525252] lowercase">of</span>
                    <TypeSelect testid={`line-type-${i}`} value={l.type} onChange={(val) => updateLine(i, { type: val })} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-[#525252] lowercase">range</span>
                    <Constraints spec={l} prefix={`line-${i}`} patch={(p) => updateLine(i, p)} />
                  </div>
                  {(l.type || "int") === "int" && (
                    <label className="flex items-center gap-1.5 cursor-pointer" data-testid={`line-${i}-distinct`}>
                      <input type="checkbox" checked={!!l.distinct} onChange={(e) => updateLine(i, { distinct: e.target.checked })} className="accent-[#007AFF] w-3 h-3" />
                      <span className="text-[10px] text-[#A3A3A3]">no repeated values (distinct)</span>
                    </label>
                  )}
                </div>
              )}

              {l.kind === "const" && (
                <input className={inputCls + " w-full"} value={l.text} onChange={(e) => updateLine(i, { text: e.target.value })} placeholder='fixed text, e.g. "YES"' />
              )}

              <p className="text-[10px] text-[#22C55E] font-mono">↳ {describeLine(l)}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          {LINE_KINDS.map((k) => (
            <button key={k.id} data-testid={`add-line-${k.id}`} onClick={() => addLine(k.id)} className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:text-white">
              <Plus size={12} /> {k.label}
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
