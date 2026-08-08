// 抖音 emoji 雪碧图渲染工具：
// 214 个表情按列表顺序拆成两张雪碧图（浏览器按需加载，避免一次加载一张大图）：
//    douyin-sprite-a.webp：前 64 个（20 列 x 4 行，每格 96px，384px 高）
//    douyin-sprite-b.webp：其余 150 个（20 列 x 8 行，每格 96px，768px 高）
// 生成脚本 scripts/gen-douyin-sprite.py 每格逐字节校验，顺序与
// douyin-emoji-data.ts 的 DOUYIN_EMOJI_LIST 一致。
//
// 为什么用 <img> 而不是 <span>：
//  - contentEditable 里 Backspace/Delete 只能删除"原子元素"（img/br/文本），
//    空 span（尤其后面还有文字时）会被 Chrome 当作可穿越容器、删不掉。
//  - img 的 src 用 1x1 透明 gif（不产生额外请求），图形通过背景雪碧图绘制；
//    提取文本时通过 data-code / alt 还原为 [code]。
// 为什么用像素值定位而不是百分比：
//  - background-size/position 用百分比在部分元素尺寸/缩放比下会落到亚像素，
//    边缘错位出现锯齿；改为按"格子像素边长"等比例换算的整数像素偏移后，
//    任意尺寸/缩放比下格子边界都对齐整数像素，边缘锐利。
import type { CSSProperties } from "react";
import { DOUYIN_EMOJI_LIST, DOUYIN_EMOJI_SPRITE_INDEX } from "@/lib/douyin-emoji-data";

export const DOUYIN_SPRITE_A_URL = "/emoji/douyin-sprite-a.webp";
export const DOUYIN_SPRITE_B_URL = "/emoji/douyin-sprite-b.webp";
export const DOUYIN_SPRITE_COLS = 20;
export const DOUYIN_SPRITE_CELL = 96;
export const DOUYIN_SPRITE_A_COUNT = 64; // 第一张包含前 64 个表情
// 1x1 透明 GIF：让 <img> 成为可删除的原子元素，图形由背景雪碧图绘制
const DOUYIN_EMPTY_GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

// 计算雪碧图 URL、格子下标、行数
function sheetFor(code: string) {
  const idx = DOUYIN_EMOJI_SPRITE_INDEX[code];
  if (idx == null) return null;
  const isA = idx < DOUYIN_SPRITE_A_COUNT;
  const local = isA ? idx : idx - DOUYIN_SPRITE_A_COUNT;
  const col = local % DOUYIN_SPRITE_COLS; // 格子水平下标（整数）
  const row = Math.floor(local / DOUYIN_SPRITE_COLS); // 格子垂直下标（整数）
  const url = isA ? DOUYIN_SPRITE_A_URL : DOUYIN_SPRITE_B_URL;
  const rows = isA ? Math.ceil(DOUYIN_SPRITE_A_COUNT / DOUYIN_SPRITE_COLS) : Math.ceil((DOUYIN_EMOJI_LIST.length - DOUYIN_SPRITE_A_COUNT) / DOUYIN_SPRITE_COLS);
  return { url, col, row, rows };
}

// 根据 Tailwind 尺寸类解析像素边长（如 "h-5 w-5" -> 20）
function boxPxFromClass(sizeClass: string): number {
  const m = /w-(\d+)/.exec(sizeClass);
  return m ? parseInt(m[1], 10) * 4 : 20;
}

// 背景 style：格子按 boxPx 缩放，偏移为格子大小的整数倍
function bgStyleFor(code: string, boxPx: number) {
  const info = sheetFor(code);
  if (!info) return null;
  return {
    image: `url('${info.url}')`,
    size: `${(DOUYIN_SPRITE_COLS * boxPx).toFixed(2)}px ${(info.rows * boxPx).toFixed(2)}px`,
    position: `-${info.col * boxPx}px -${info.row * boxPx}px`,
  };
}

// 生成雪碧图 <img> 的 HTML，boxPx 由 sizeClass 推导（默认 h-5 w-5 = 20px）
export function douyinEmojiSpriteHtml(code: string, sizeClass = "h-5 w-5"): string {
  const s = bgStyleFor(code, boxPxFromClass(sizeClass));
  if (!s) return code;
  return (
    `<img class="djy-emoji inline-block align-middle mx-0.5 ${sizeClass}" data-emoji data-code="${code}"` +
    ` alt="${code}" title="${code}" src="${DOUYIN_EMPTY_GIF}" draggable="false"` +
    ` style="background-image:${s.image};background-repeat:no-repeat;` +
    `background-size:${s.size};background-position:${s.position}"></img>`
  );
}

// 返回 React style 对象（用于网格按钮等 JSX 直接渲染，默认 24px 格）
export function douyinEmojiSpriteStyle(code: string, boxPx = 24): CSSProperties | undefined {
  const info = sheetFor(code);
  if (!info) return undefined;
  return {
    backgroundImage: `url('${info.url}')`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${DOUYIN_SPRITE_COLS * boxPx}px ${info.rows * boxPx}px`,
    backgroundPosition: `-${info.col * boxPx}px -${info.row * boxPx}px`,
  };
}