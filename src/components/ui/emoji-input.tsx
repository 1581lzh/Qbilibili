"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { renderEmojiText } from "@/lib/emoji-data";
import { insertHtmlAtCursor, getContentEditableCodeText } from "@/lib/emoji";

export interface EmojiInputHandle {
  insert(text: string, html?: string): void;
}

interface EmojiInputProps {
  value: string;
  onChange: (text: string) => void;
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

// 计算字符串的显示长度（emoji 代码按 [xxx] 为一段，避免截断在代码中间）
function truncateCodeSafe(text: string, max: number): string {
  if (text.length <= max) return text;
  let out = "";
  let i = 0;
  while (i < text.length && out.length < max) {
    const m = /^\[[^\]]+\]/.exec(text.slice(i));
    const token = m ? m[0] : text[i];
    if (out.length > 0 && out.length + token.length > max) break;
    out += token;
    i += token.length;
  }
  return out;
}

function placeCaretAtEnd(el: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

// contentEditable 输入框：插入的 emoji 以图形实时显示，
// 提取/提交时还原为 [xxx] 代码文本存储
const EmojiInput = forwardRef<EmojiInputHandle, EmojiInputProps>(function EmojiInput(
  { value, onChange, maxLength, multiline = false, placeholder, className = "" },
  ref
) {
  const innerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const lastEmittedRef = useRef("");
  const composingRef = useRef(false);
  const initDoneRef = useRef(false);

  // ref 回调在首次提交时执行（早于 effect），此时同步一次初始内容，避免闪烁
  const setDomRef = (el: HTMLDivElement | null) => {
    innerRef.current = el;
    if (el && !initDoneRef.current) {
      initDoneRef.current = true;
      if (valueRef.current) el.innerHTML = renderEmojiText(valueRef.current);
    }
  };

  // 外部 value 变化（如编辑页加载数据）时重新渲染；自己输入导致的 value 回环则跳过
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (valueRef.current === lastEmittedRef.current) return;
    const html = renderEmojiText(valueRef.current);
    if (el.innerHTML !== html) el.innerHTML = html;
    lastEmittedRef.current = valueRef.current;
  }, [value]);

  const extractAndReport = () => {
    const el = innerRef.current;
    if (!el) return;
    if (composingRef.current) return;
    let text = getContentEditableCodeText(el);
    if (maxLength && text.length > maxLength) {
      text = truncateCodeSafe(text, maxLength);
      el.innerHTML = renderEmojiText(text);
      placeCaretAtEnd(el);
    }
    if (text !== lastEmittedRef.current) {
      lastEmittedRef.current = text;
      onChange(text);
    }
  };

  useImperativeHandle(ref, () => ({
    insert(text: string, html?: string) {
      const el = innerRef.current;
      if (!el) return;
      el.focus();
      if (html) {
        insertHtmlAtCursor(innerRef, html);
      } else {
        // 普通文本插入：优先插入到现有光标位置，失焦/无选区则放到末尾
        let selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && el.contains(selection.getRangeAt(0).startContainer)) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const node = document.createTextNode(text);
          range.insertNode(node);
          const caret = document.createRange();
          caret.setStartAfter(node);
          caret.collapse(true);
          selection.removeAllRanges();
          selection.addRange(caret);
        } else {
          const node = document.createTextNode(text);
          el.appendChild(node);
          placeCaretAtEnd(el);
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      extractAndReport();
    },
  }));

  return (
    <div
      ref={setDomRef}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder || ""}
      onInput={extractAndReport}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
        extractAndReport();
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") e.preventDefault();
      }}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={() => {
        composingRef.current = false;
        extractAndReport();
      }}
      className={`[&[data-placeholder]:empty:before]:content-[attr(data-placeholder)] [&:empty]:before:pointer-events-none [&:empty]:before:text-zinc-400 [&:empty]:before:dark:text-zinc-500 ${
        multiline ? "whitespace-pre-wrap break-words" : "break-words"
      } ${className}`}
    />
  );
});

export default EmojiInput;