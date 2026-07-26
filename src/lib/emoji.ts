// 在 textarea/input 光标位置插入文本
export function insertTextAtCursor(
  ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
  text: string
) {
  const el = ref.current;
  if (!el) return;

  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const value = el.value;
  const newValue = value.slice(0, start) + text + value.slice(end);

  // 使用 nativeInputValueSetter 触发 React 的 onChange
  const nativeSetter =
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set ||
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  nativeSetter?.call(el, newValue);

  el.dispatchEvent(new Event("input", { bubbles: true }));

  // 恢复光标位置到插入文本之后
  const newPos = start + text.length;
  requestAnimationFrame(() => {
    el.selectionStart = newPos;
    el.selectionEnd = newPos;
    el.focus();
  });
}

// 计算字符串的实际显示长度（emoji 算 1 个字符）
export function getDisplayLength(text: string): number {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
    return [...segmenter.segment(text)].length;
  }
  return [...text].length;
}

// 检测字符是否是 emoji
export function isEmoji(char: string): boolean {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
  return emojiRegex.test(char);
}
