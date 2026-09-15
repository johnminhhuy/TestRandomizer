import React, { useRef, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";

const SIMPLE_KEYWORDS = ["let", "print", "list", "word", "text", "blank"];
const SIMPLE_OPS = ["in", "distinct"];
const SIMPLE_TYPES = ["ints", "int", "numbers", "chars", "char", "letters"];

const simpleParser = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/#.*/)) return "comment";
    if (stream.match(/\.\./)) return "operator";
    if (stream.match(/\d+/)) return "number";
    if (stream.match(/[a-zA-Z_]\w*/)) {
      const w = stream.current();
      if (SIMPLE_KEYWORDS.includes(w)) return "keyword";
      if (SIMPLE_OPS.includes(w)) return "operator";
      if (SIMPLE_TYPES.includes(w)) return "atom";
      return "variableName";
    }
    if (stream.match(/[=(),+\-*/%]/)) return "operator";
    stream.next();
    return null;
  },
});

const ADV_KEYWORDS = ["int", "print", "array", "grid", "blank"];

const advancedParser = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/#.*/)) return "comment";
    if (stream.match(/\d+/)) return "number";
    if (stream.match(/[a-zA-Z_]\w*/)) {
      const w = stream.current();
      if (ADV_KEYWORDS.includes(w)) return "keyword";
      return "variableName";
    }
    if (stream.match(/\/\/|\.\.|\*\*|[-+*%(),=]/)) return "operator";
    stream.next();
    return null;
  },
});

export const TemplateEditor = ({ mode, value, onChange, testid }) => {
  const lang = mode === "advanced" ? advancedParser : simpleParser;
  const ref = useRef(null);

  // Force the editor to reflect external `value` changes (e.g. presets / AI fill)
  // even after the user has typed into it.
  useEffect(() => {
    const view = ref.current?.view;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      data-testid={testid}
      className="border border-[#262626] rounded-sm overflow-hidden focus-within:ring-2 focus-within:ring-[#007AFF]"
    >
      <CodeMirror
        ref={ref}
        value={value}
        height="224px"
        theme={oneDark}
        extensions={[lang]}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
        style={{ fontSize: 12.5 }}
      />
    </div>
  );
};
