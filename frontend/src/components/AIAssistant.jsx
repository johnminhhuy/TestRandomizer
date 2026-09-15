import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Sparkle, Code, Flask, CircleNotch, Key, CaretDown, CheckCircle, BookOpen, ListNumbers } from "@phosphor-icons/react";
import { aiGenerateSolution, aiGenerateGenerator, aiStatus, aiSetConfig, aiExplainCode } from "../lib/apiClient";
import { toast } from "sonner";

const MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];

const LANGS = [
  { id: "cpp", label: "C++17" },
  { id: "python", label: "Python 3" },
  { id: "java", label: "Java" },
];

const btn =
  "w-full flex items-center justify-center gap-2 font-display font-bold uppercase tracking-widest text-xs px-4 h-10 rounded-sm transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";

const ConnectionSection = ({ open }) => {
  const [status, setStatus] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(MODELS[0]);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      const s = await aiStatus();
      setStatus(s);
      if (s.model) setModel(s.model);
    } catch (e) {
      setStatus({ enabled: false });
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await aiSetConfig({ apiKey: apiKey || undefined, model });
      setStatus(res);
      setApiKey("");
      setExpanded(false);
      toast.success("AI connection saved", { description: `Model: ${res.model}` });
    } catch (e) {
      toast.error("Couldn't save key", { description: e?.response?.data?.detail || e.message });
    } finally {
      setSaving(false);
    }
  };

  const useDefault = async () => {
    setSaving(true);
    try {
      const res = await aiSetConfig({ clear: true });
      setStatus(res);
      setApiKey("");
      toast("Reverted to default key");
    } catch (e) {
      toast.error("Failed", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-[#262626] rounded-sm bg-[#050505]" data-testid="ai-connection">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 h-10 text-left"
      >
        <span className="flex items-center gap-2 text-xs">
          <Key size={14} className="text-[#007AFF]" />
          <span className="text-[#A3A3A3]">Groq connection</span>
          {status && (
            <span className={`flex items-center gap-1 text-[10px] ${status.enabled ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
              <CheckCircle size={11} weight="fill" />
              {status.enabled ? (status.usingUserKey ? "your key" : "default key") : "not set"}
            </span>
          )}
        </span>
        <CaretDown size={13} className={`text-[#525252] transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <label className="text-[9px] uppercase text-[#525252] tracking-wider">API key (gsk_...)</label>
            <input
              data-testid="ai-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={status?.usingUserKey ? "•••••• (saved) — type to replace" : "paste your Groq key"}
              className="mt-1 w-full bg-[#1E1E1E] border border-[#262626] text-white text-xs font-mono px-2 py-1.5 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[10px] text-[#007AFF] hover:text-white">
              get a free key at console.groq.com/keys →
            </a>
          </div>
          <div>
            <label className="text-[9px] uppercase text-[#525252] tracking-wider">Model</label>
            <select
              data-testid="ai-model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full bg-[#1E1E1E] border border-[#262626] text-white text-xs font-mono px-2 py-1.5 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] cursor-pointer"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              data-testid="ai-save-key-btn"
              onClick={save}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#007AFF] hover:bg-white hover:text-[#050505] text-white font-display font-bold uppercase tracking-widest text-[11px] h-8 rounded-sm transition-colors disabled:opacity-40"
            >
              {saving ? <CircleNotch size={13} className="animate-spin" /> : <Key size={13} />} Save
            </button>
            {status?.usingUserKey && status?.defaultAvailable && (
              <button
                data-testid="ai-use-default-btn"
                onClick={useDefault}
                disabled={saving}
                className="border border-[#262626] text-[#A3A3A3] hover:text-white text-[11px] px-3 h-8 rounded-sm transition-colors"
              >
                Use default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const AIAssistant = ({
  open,
  onOpenChange,
  problem,
  setProblem,
  setUserCode,
  setBruteCode,
  setBruteLang,
  setUserLang,
  setTemplate,
  setMode,
}) => {
  const [solTarget, setSolTarget] = useState("brute");
  const [solLang, setSolLang] = useState("cpp");
  const [loadingSol, setLoadingSol] = useState(false);
  const [loadingGen, setLoadingGen] = useState(false);
  const [lastNote, setLastNote] = useState("");
  const [lastSolution, setLastSolution] = useState(null);
  const [codeExplain, setCodeExplain] = useState(null);
  const [loadingExplain, setLoadingExplain] = useState(false);

  const guardProblem = () => {
    if (!problem.trim()) {
      toast.error("Add a problem statement first");
      return false;
    }
    return true;
  };

  const onGenSolution = async () => {
    if (!guardProblem()) return;
    setLoadingSol(true);
    setLastNote("");
    setCodeExplain(null);
    try {
      const res = await aiGenerateSolution(problem, solLang);
      if (solTarget === "brute") {
        setBruteCode(res.code);
        setBruteLang(res.language);
      } else {
        setUserCode(res.code);
        setUserLang(res.language);
      }
      setLastNote(res.explanation || "Solution generated.");
      setLastSolution({ code: res.code, language: res.language });
      toast.success(`Reference solution added to ${solTarget === "brute" ? "Correct" : "Your"} editor`);
    } catch (e) {
      toast.error("AI failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoadingSol(false);
    }
  };

  const onExplainCode = async () => {
    if (!lastSolution) return;
    setLoadingExplain(true);
    try {
      const res = await aiExplainCode({
        code: lastSolution.code,
        language: lastSolution.language,
        problem: problem || "",
      });
      setCodeExplain(res);
    } catch (e) {
      toast.error("AI failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoadingExplain(false);
    }
  };

  const onGenGenerator = async () => {
    if (!guardProblem()) return;
    setLoadingGen(true);
    setLastNote("");
    try {
      const res = await aiGenerateGenerator(problem);
      setTemplate(res.template);
      setMode("advanced");
      setLastNote(res.explanation || "Generator template created.");
      toast.success("Test generator created (Advanced tab)");
    } catch (e) {
      toast.error("AI failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoadingGen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="ai-assistant-sheet"
        className="bg-[#0c0c0c] border-l border-[#262626] text-white w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display font-black uppercase tracking-tight text-white">
            <Sparkle size={20} weight="fill" className="text-[#007AFF]" /> AI Assistant
          </SheetTitle>
          <SheetDescription className="text-[#A3A3A3] text-xs">
            Paste a problem statement — Groq will write a reference solution and a matching random-test generator.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <ConnectionSection open={open} />

          <div>
            <label className="font-display text-[10px] uppercase tracking-[0.2em] text-[#A3A3A3]">
              Problem Statement
            </label>
            <textarea
              data-testid="ai-problem-input"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. Given n and an array of n integers, print the sum. Input: line 1 = n (1<=n<=1000), line 2 = n integers (1..1e9). Output: the sum."
              spellCheck={false}
              className="mt-2 w-full h-40 bg-[#1E1E1E] border border-[#262626] text-white text-xs p-3 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] resize-none leading-relaxed"
            />
          </div>

          {/* Solution generation */}
          <div className="border border-[#262626] rounded-sm p-3 space-y-3 bg-[#050505]">
            <div className="flex items-center gap-2">
              <Code size={16} className="text-[#22C55E]" />
              <span className="font-display text-xs uppercase tracking-widest text-white">
                Reference Solution
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-[#525252] tracking-wider">Fill into</label>
                <select
                  data-testid="ai-sol-target"
                  value={solTarget}
                  onChange={(e) => setSolTarget(e.target.value)}
                  className="mt-1 w-full bg-[#1E1E1E] border border-[#262626] text-white text-xs font-mono px-2 py-1.5 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] cursor-pointer"
                >
                  <option value="brute">Correct / Brute</option>
                  <option value="user">Your Solution</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase text-[#525252] tracking-wider">Language</label>
                <select
                  data-testid="ai-sol-lang"
                  value={solLang}
                  onChange={(e) => setSolLang(e.target.value)}
                  className="mt-1 w-full bg-[#1E1E1E] border border-[#262626] text-white text-xs font-mono px-2 py-1.5 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] cursor-pointer"
                >
                  {LANGS.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              data-testid="ai-gen-solution-btn"
              onClick={onGenSolution}
              disabled={loadingSol}
              className={btn + " bg-[#22C55E] text-[#050505] hover:bg-white"}
            >
              {loadingSol ? <CircleNotch size={16} className="animate-spin" /> : <Code size={16} />}
              {loadingSol ? "Writing..." : "Generate Solution"}
            </button>

            {lastSolution && (
              <>
                <button
                  data-testid="ai-explain-code-btn"
                  onClick={onExplainCode}
                  disabled={loadingExplain}
                  className="w-full flex items-center justify-center gap-2 border border-[#22C55E]/50 text-[#22C55E] hover:bg-[#22C55E] hover:text-[#050505] font-display font-bold uppercase tracking-widest text-[11px] px-3 h-9 rounded-sm transition-colors disabled:opacity-40"
                >
                  {loadingExplain ? <CircleNotch size={14} className="animate-spin" /> : <BookOpen size={14} />}
                  {loadingExplain ? "Explaining..." : "Explain this code in detail"}
                </button>
                {codeExplain && (
                  <div data-testid="ai-code-explanation" className="space-y-2.5 pt-1">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-[#4da3ff] mb-1">Approach</div>
                      <p className="text-xs text-[#cfe4ff] leading-relaxed">{codeExplain.approach}</p>
                    </div>
                    {codeExplain.steps?.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#A3A3A3] mb-1">
                          <ListNumbers size={12} /> Step by step
                        </div>
                        <ol className="space-y-1">
                          {codeExplain.steps.map((s, i) => (
                            <li key={i} className="flex gap-2 text-xs text-[#e5e5e5] leading-relaxed">
                              <span className="text-[#22C55E] font-mono">{i + 1}.</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {codeExplain.complexity && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-[#EAB308] mb-1">Complexity</div>
                        <p className="text-xs text-[#f0e6c9] font-mono leading-relaxed">{codeExplain.complexity}</p>
                      </div>
                    )}
                    {codeExplain.edgeCases && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-[#D946EF] mb-1">Edge cases</div>
                        <p className="text-xs text-[#f3d9f7] leading-relaxed">{codeExplain.edgeCases}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Generator generation */}
          <div className="border border-[#262626] rounded-sm p-3 space-y-3 bg-[#050505]">
            <div className="flex items-center gap-2">
              <Flask size={16} className="text-[#EAB308]" />
              <span className="font-display text-xs uppercase tracking-widest text-white">
                Test Generator
              </span>
            </div>
            <p className="text-[11px] text-[#A3A3A3]">
              Creates an Advanced-mode template that produces small random tests matching the input format.
            </p>
            <button
              data-testid="ai-gen-generator-btn"
              onClick={onGenGenerator}
              disabled={loadingGen}
              className={btn + " bg-[#EAB308] text-[#050505] hover:bg-white"}
            >
              {loadingGen ? <CircleNotch size={16} className="animate-spin" /> : <Flask size={16} />}
              {loadingGen ? "Building..." : "Generate Generator"}
            </button>
          </div>

          {lastNote && (
            <div
              data-testid="ai-note"
              className="border border-[#007AFF]/40 bg-[#007AFF]/10 rounded-sm p-3 text-xs text-[#cfe4ff] leading-relaxed"
            >
              {lastNote}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
