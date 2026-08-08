#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成抖音 emoji 雪碧图（按列表顺序拆成两张，按需加载）：
    A: 前 64 个表情  -> public/emoji/douyin-sprite-a.png / .webp (20 列 x 4 行)
    B: 其余 150 个  -> public/emoji/douyin-sprite-b.png / .webp (20 列 x 8 行)
每格 96x96。顺序与 src/lib/douyin-emoji-data.ts 中 DOUYIN_EMOJI_LIST 保持一致。
生成后自动逐格校验：粘贴结果与源图逐像素比对，不一致的格子会列出来。

用法:
    python3 scripts/gen-douyin-sprite.py

分割数量见 SPLIT，列数见 COLS，压缩品质见 WEBP_QUALITY。
"""
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(ROOT, "src", "lib", "douyin-emoji-data.ts")
OUT_DIR = os.path.join(ROOT, "public", "emoji")

CELL = 96
COLS = 20
SPLIT = 64  # 第一张雪碧图包含多少表情
WEBP_QUALITY = 92


def load_images(urls: list[str]) -> list[Image.Image]:
    ims = []
    for url in urls:
        path = os.path.join(ROOT, "public", url.lstrip("/"))
        with Image.open(path) as im:
            im = im.convert("RGBA")
            im.thumbnail((CELL, CELL), Image.LANCZOS)
            ims.append(im)
    return ims


def save_sheet(urls: list[str], ims: list[Image.Image], label: str) -> bool:
    rows = (len(ims) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    rects = []
    for idx, im in enumerate(ims):
        col, row = idx % COLS, idx // COLS
        x = col * CELL + (CELL - im.width) // 2
        y = row * CELL + (CELL - im.height) // 2
        # 不带 mask 直接拷贝：带 mask 粘贴会把半透明边缘像素与背景混合变暗，
        # 原始 rgba 拷贝保证格子内容与源图逐像素一致
        sheet.paste(im, (x, y))
        rects.append((x, y, im))
    out_png = os.path.join(OUT_DIR, f"douyin-sprite-{label}.png")
    out_webp = os.path.join(OUT_DIR, f"douyin-sprite-{label}.webp")
    sheet.save(out_png, "PNG", optimize=True)
    sheet.save(out_webp, "WEBP", quality=WEBP_QUALITY, method=6)

    bad = 0
    for idx, (x, y, im) in enumerate(rects):
        cell = sheet.crop((x, y, x + im.width, y + im.height))
        if cell.tobytes() != im.tobytes():
            bad += 1
            print(f"  [校验] 第 {idx} 格与源图不一致: {urls[idx]}", file=sys.stderr)
    print(f"{label}: {len(ims)} 个 -> {COLS}x{rows} 网格 ({sheet.width}x{sheet.height}) {'✓' if bad == 0 else '✗ 有差异'}")
    return bad == 0


def main() -> int:
    src = open(DATA_FILE, encoding="utf-8").read()
    urls = re.findall(r'\{\s*code:\s*"[^"]+",\s*name:\s*"[^"]+",\s*url:\s*"([^"]+)"\s*\}', src)
    if not urls:
        print("未从 douyin-emoji-data.ts 中解析到 emoji 列表", file=sys.stderr)
        return 1

    ims = load_images(urls)
    if len(ims) != len(urls):
        print("读取表情图片数量与列表不一致", file=sys.stderr)
        return 1

    ok_a = save_sheet(urls[:SPLIT], ims[:SPLIT], "a")
    ok_b = save_sheet(urls[SPLIT:], ims[SPLIT:], "b")
    print("生成完成: 前端按需加载 douyin-sprite-a.webp（前64个）与 douyin-sprite-b.webp（其余所有）")
    return 0 if (ok_a and ok_b) else 2


if __name__ == "__main__":
    sys.exit(main())