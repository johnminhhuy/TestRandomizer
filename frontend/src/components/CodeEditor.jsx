import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { oneDark } from "@codemirror/theme-one-dark";

const extFor = (lang) => {
  if (lang === "python") return [python()];
  if (lang === "java") return [java()];
  return [cpp()];
};

const LANGS = [
  { id: "cpp", label: "C++17" },
  { id: "python", label: "Python 3" },
  { id: "java", label: "Java" },
];

export const CodeEditor = ({ title, testid, lang, onLangChange, value, onChange }) => {
  return (
    <div className="flex flex-col min-h-0 flex-1" data-testid={testid}>
      <div className="flex items-center justify-between px-4 h-11 border-b border-[#262626] bg-[#0c0c0c] shrink-0">
        <span className="font-display text-xs uppercase tracking-[0.2em] text-[#A3A3A3]">
          {title}
        </span>
        <select
          data-testid={`${testid}-lang`}
          value={lang}
          onChange={(e) => onLangChange(e.target.value)}
          className="bg-[#1E1E1E] border border-[#262626] text-white text-xs font-mono px-2 py-1 rounded-sm outline-none focus:ring-2 focus:ring-[#007AFF] cursor-pointer"
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <CodeMirror
          value={value}
          height="100%"
          theme={oneDark}
          extensions={extFor(lang)}
          onChange={onChange}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
          style={{ fontSize: 13, height: "100%" }}
        />
      </div>
    </div>
  );
};
