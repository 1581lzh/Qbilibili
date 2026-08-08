"use client";

import { renderEmojiText } from "@/lib/emoji-data";

interface EmojiTextProps {
  text: string;
  className?: string;
  max?: number;
}

// 渲染支持 emoji 的文本：抖音表情转图片、B站格式 [xx] 转 Unicode emoji
export default function EmojiText({ text, className, max }: EmojiTextProps) {
  let content = text;
  if (max && content.length > max) {
    content = content.slice(0, max) + "...";
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderEmojiText(content) }} />;
}