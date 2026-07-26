"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EMOJI_CATEGORIES } from "@/lib/emoji-data";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 搜索过滤
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return EMOJI_CATEGORIES;
    const q = search.toLowerCase();
    return EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter(
        (e) => e.label.toLowerCase().includes(q) || e.emoji.includes(q)
      ),
    })).filter((cat) => cat.emojis.length > 0);
  }, [search]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        title="插入 emoji"
      >
        😊
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 z-50 mb-2 w-[320px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
          >
            {/* 搜索栏 */}
            <div className="border-b border-zinc-100 p-2 dark:border-zinc-700">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索 emoji..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-[#FB7299] focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
                autoFocus
              />
            </div>

            {/* 分类标签 */}
            {!search && (
              <div className="flex border-b border-zinc-100 dark:border-zinc-700">
                {EMOJI_CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setActiveCategory(i)}
                    className={`flex-1 py-2 text-center text-lg transition-colors ${
                      activeCategory === i
                        ? "border-b-2 border-[#FB7299] text-[#FB7299]"
                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    }`}
                  >
                    {cat.icon}
                  </button>
                ))}
              </div>
            )}

            {/* Emoji 网格 */}
            <div className="h-[240px] overflow-y-auto p-2">
              {filteredCategories.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                  未找到匹配的 emoji
                </div>
              ) : (
                (search ? filteredCategories : [EMOJI_CATEGORIES[activeCategory]]).map(
                  (cat) => (
                    <div key={cat.name}>
                      {!search && (
                        <div className="mb-1 px-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                          {cat.name}
                        </div>
                      )}
                      <div className="grid grid-cols-8 gap-0.5">
                        {cat.emojis.map((e) => (
                          <button
                            key={e.emoji}
                            type="button"
                            onClick={() => handleSelect(e.emoji)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            title={e.label}
                          >
                            {e.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
