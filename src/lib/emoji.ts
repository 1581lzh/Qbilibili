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

// 在 contentEditable div 光标位置插入 HTML
export function insertHtmlAtCursor(
  ref: React.RefObject<HTMLDivElement | null>,
  html: string
) {
  const el = ref.current;
  if (!el) return;

  el.focus();

  const selection = window.getSelection();
  if (!selection) return;

  // 如果元素已失焦导致选区丢失，回退：把光标放到元素末尾再插入
  if (selection.rangeCount === 0 || !el.contains(selection.getRangeAt(0).startContainer)) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  // 创建临时容器解析 HTML
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const fragment = document.createDocumentFragment();
  while (temp.firstChild) {
    fragment.appendChild(temp.firstChild);
  }

  range.insertNode(fragment);

  // 移动光标到插入内容之后
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  // 触发 input 事件
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// 获取 contentEditable div 的纯文本内容
export function getContentEditableText(ref: React.RefObject<HTMLDivElement | null>): string {
  return ref.current?.textContent || "";
}

// 从 contentEditable div 提取含 emoji 代码（[xxx]）的纯文本：
// 内联的 emoji 图片（<img> 的 alt / 雪碧图 span 的 data-code）还原为代码文本，其它节点取文本
export function getContentEditableCodeText(el: HTMLElement | null): string {
  if (!el) return "";
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent || "");
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName.toLowerCase();
      const dataset = (node as HTMLElement).dataset;
      if (tag === "img") parts.push((node as HTMLImageElement).alt || "");
      else if (dataset && dataset.code) parts.push(dataset.code);
      else if (tag === "br") parts.push("\n");
      else (node as HTMLElement).childNodes.forEach(walk);
    }
  };
  el.childNodes.forEach(walk);
  return parts.join("");
}

// 清空 contentEditable div
export function clearContentEditable(ref: React.RefObject<HTMLDivElement | null>) {
  if (ref.current) {
    ref.current.innerHTML = "";
  }
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
