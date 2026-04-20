"use client";

import { useRef, useEffect } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 120 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (isInternalChange.current) { isInternalChange.current = false; return; }
    if (el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => {
        isInternalChange.current = true;
        onChange((e.currentTarget as HTMLDivElement).innerHTML);
      }}
      data-placeholder={placeholder}
      className="outline-none px-3 py-2.5 text-[13.5px] leading-relaxed"
      style={{
        minHeight,
        color: "#111b21",
        wordBreak: "break-word",
      }}
    />
  );
}
