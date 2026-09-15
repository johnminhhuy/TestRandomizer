import React, { useState } from "react";
import { Eye, BookOpen, CaretDown } from "@phosphor-icons/react";
import { previewGenerator } from "../lib/apiClient";
import { SIMPLE_PRESETS, ADVANCED_PRESETS, CODE_PRESETS } from "../lib/constants";
import { TemplateEditor } from "./TemplateEditor";
import { CodeEditor } from "./CodeEditor";
import { toast } from "sonner";

const SIMPLE_GUIDE = [
  { code: "let n = 1..8", desc: "define a random number you can reuse below" },
  { code: "print n", desc: "write one line with these values (e.g. print a b)" },
  { code: "list n ints in 1..20", desc: "n random integers on one line" },
  { code: "list n distinct ints in 1..50", desc: "…with no repeats" },
  { code: "list n floats in 0..1", desc: "n random decimals on one line" },
  { code: "list n chars in a-z", desc: "n random letters on one line" },
  { code: "word 5 in a-z", desc: "one random string of length 5" },
  { code: "text YES", desc: "a fixed line of text" },
];

const ADVANCED_GUIDE = [
  { code: "n = int(1, 100)", desc: "random int variable — ranges can use math: int(1, n-1)" },
  { code: "print(n, m)", desc: "print values space-separated on one line" },
  { code: "array(count, lo, hi)", desc: "one line of `count` random ints" },
  { code: "grid(rows, cols, lo, hi)", desc: "rows lines × cols ints — matrices & edge lists" },
  { code: "chars(count, a-z)", desc: "one line of `count` random characters" },
  { code: "word(len, a-z)", desc: "one random string of the given length" },
  { code: "floats(count, lo, hi, dec)", desc: "random decimals (dec = decimal places)" },
  { code: "blank", desc: "an empty line" },
];

const CODE_GUIDE = [
  { code: "print(...)", desc: "write your test case straight to stdout — full freedom" },
  { code: "seed = argv[1]", desc: "the random seed arrives as the 1st command-line arg" },
  { code: "random.seed(seed)", desc: "seed your RNG with it so every test differs" },
  { code: "any language", desc: "Python / C++ / Java — code any algorithm you want" },
];

const Guide = ({ items, testid }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-[#262626] rounded-sm bg-[#0c0c0c]" data-testid={testid}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 h-9 text-[#A3A3A3] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2 font-display text-[10px] uppercase tracking-[0.2em]">
          <BookOpen size={13} /> Syntax guide
        </span>
        <CaretDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <code className="text-[11px] text-[#EAB308] font-mono">{it.code}</code>
              <span className="text-[10px] text-[#A3A3A3] leading-snug">{it.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Presets = ({ presets, onPick, active, keyName }) => (
  <div className="flex flex-wrap gap-1.5">
    {presets.map((p) => (
      <button
        key={p.id}
        data-testid={`preset-${p.id}`}
        onClick={() => onPick(p[keyName], p)}
        className={`text-[11px] px-2.5 py-1 rounded-sm border transition-colors ${
          active === p[keyName]
            ? "bg-[#007AFF] border-[#007AFF] text-white"
            : "bg-transparent border-[#262626] text-[#A3A3A3] hover:border-[#007AFF] hover:text-white"
        }`}
      >
        {p.label}
      </button>
    ))}
  </div>
);

export const GeneratorPanel = ({
  mode, setMode, simpleText, setSimpleText, template, setTemplate,
  genCode, setGenCode, genLang, setGenLang,
}) => {
  const [preview, setPreview] = useState("");
  const [previewErr, setPreviewErr] = useState("");
  const [loading, setLoading] = useState(false);

  const buildGenerator = () => {
    if (mode === "simple") return { mode: "simple", text: simpleText };
    if (mode === "advanced") return { mode: "advanced", template };
    return { mode: "code", language: genLang, code: genCode };
  };

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

  const isSimple = mode === "simple";
  const isCode = mode === "code";
  const value = isSimple ? simpleText : template;
  const setValue = isSimple ? setSimpleText : setTemplate;

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="generator-panel">
      <div className="flex border-b border-[#262626] shrink-0">
        {[
          { id: "simple", label: "Simple" },
          { id: "advanced", label: "Advanced" },
          { id: "code", label: "Code" },
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

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.2em] text-[#A3A3A3] mb-1.5">
            {isSimple ? "Readable template" : isCode ? "Custom generator program" : "Advanced template"}
          </p>
          <p className="text-[10px] text-[#525252] mb-2">
            {isSimple
              ? "Write your test in plain lines. Tap a preset to start."
              : isCode
              ? "Code any algorithm to print a test. The seed comes in as argv[1]."
              : "Function-style generator with variables, math, grids, chars, words & floats."}
          </p>
          <Presets
            presets={isSimple ? SIMPLE_PRESETS : isCode ? CODE_PRESETS : ADVANCED_PRESETS}
            keyName={isSimple ? "text" : isCode ? "code" : "template"}
            active={isCode ? genCode : value}
            onPick={(picked, preset) => {
              if (isCode) {
                setGenCode(picked);
                if (preset?.lang) setGenLang(preset.lang);
              } else {
                setValue(picked);
              }
            }}
          />
        </div>

        {isCode ? (
          <div className="h-72">
            <CodeEditor
              title="Generator program"
              testid="code-generator-editor"
              lang={genLang}
              onLangChange={setGenLang}
              value={genCode}
              onChange={setGenCode}
            />
          </div>
        ) : (
          <TemplateEditor
            mode={mode}
            value={value}
            onChange={setValue}
            testid={isSimple ? "simple-template" : "advanced-template"}
          />
        )}

        <Guide
          items={isSimple ? SIMPLE_GUIDE : isCode ? CODE_GUIDE : ADVANCED_GUIDE}
          testid={isSimple ? "simple-guide" : isCode ? "code-guide" : "advanced-guide"}
        />
      </div>

      {/* Preview — highlighted result card */}
      <div className="border-t-2 border-[#007AFF]/40 bg-[#0a1420] shrink-0">
        <div className="flex items-center justify-between px-4 h-10">
          <span className="flex items-center gap-1.5 font-display text-[11px] uppercase tracking-[0.2em] text-[#4da3ff]">
            <Eye size={14} weight="fill" /> Preview
          </span>
          <button
            data-testid="preview-btn"
            onClick={doPreview}
            disabled={loading}
            className="flex items-center gap-1.5 bg-[#007AFF] hover:bg-white hover:text-[#050505] text-white font-display font-bold uppercase tracking-widest text-[10px] px-3 h-7 rounded-sm transition-colors disabled:opacity-40"
          >
            <Eye size={13} /> {loading ? "generating..." : "generate sample"}
          </button>
        </div>
        <pre
          data-testid="preview-output"
          className={`mx-4 mb-4 p-3 rounded-sm border min-h-[64px] max-h-44 overflow-auto text-[13px] font-mono whitespace-pre-wrap ${
            previewErr
              ? "text-[#ff8a8a] border-[#EF4444]/40 bg-[#1a0d0d]"
              : preview
              ? "text-[#7ef0a0] border-[#22C55E]/30 bg-[#0a1a0f]"
              : "text-[#607089] border-[#1f3350] bg-[#0a1420]"
          }`}
        >
          {previewErr || preview || "▶  Click “generate sample” to see a random test case here."}
        </pre>
      </div>
    </div>
  );
};
