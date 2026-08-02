import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Sparkle, Code, Flask, CircleNotch } from "@phosphor-icons/react";
import { aiGenerateSolution, aiGenerateGenerator } from "../lib/apiClient";
import { toast } from "sonner";

const LANGS = [
  { id: "cpp", label: "C++17" },
  { id: "python", label: "Python 3" },
  { id: "java", label: "Java" },
];

const btn =
  "w-full flex items-center justify-center gap-2 font-display font-bold uppercase tracking-widest text-xs px-4 h-10 rounded-sm transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";

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
      toast.success(`Reference solution added to ${solTarget === "brute" ? "Correct" : "Your"} editor`);
    } catch (e) {
      toast.error("AI failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoadingSol(false);
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
