"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Sun, Moon, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { motion, AnimatePresence } from "framer-motion";

const AVATAR_COLORS = [
  "bg-pink-500", "bg-violet-500", "bg-blue-500", "bg-cyan-500",
  "bg-green-500", "bg-amber-500", "bg-red-500", "bg-indigo-500",
];

const SEARCH_HISTORY_KEY = "bilibili_search_history";

function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSearchHistory(history: string[]) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

export function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const { openLogin, openRegister } = useAuthModal();
  const pathname = usePathname();
  const { resolved, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    setOpen(false);
    if (pathname === "/search") {
      const params = new URLSearchParams(window.location.search);
      setSearchQuery(params.get("q") || "");
    } else {
      setSearchQuery("");
      setSearchExpanded(false);
    }
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!searchExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchExpanded(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchExpanded]);

  useEffect(() => {
    if (!searchFocused) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside as EventListener);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside as EventListener);
    };
  }, [searchFocused]);

  const showMenu = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), 140);
  }, []);

  const hideMenu = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  const cancelHide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside as EventListener);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside as EventListener);
    };
  }, [open]);

  const addToHistory = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchHistory((prev) => {
      const newHistory = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 20);
      saveSearchHistory(newHistory);
      return newHistory;
    });
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim()) {
      searchTimerRef.current = setTimeout(() => {
        router.push(`/search?q=${encodeURIComponent(value.trim())}`);
      }, 200);
    } else if (pathname !== "/") {
      router.push("/");
    }
  };

  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      if (searchContainerRef.current?.contains(e.relatedTarget as Node)) return;
      if (searchQuery.trim()) addToHistory(searchQuery);
      setSearchFocused(false);
      setSearchExpanded(false);
    }, 150);
  }, [searchQuery, addToHistory]);

  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true);
    setSearchHistory(getSearchHistory());
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchQuery.trim()) {
      addToHistory(searchQuery);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchFocused(false);
      setSearchExpanded(false);
    }
  };

  const openMobileSearch = useCallback(() => {
    setSearchExpanded(true);
    setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
  }, []);

  const closeMobileSearch = useCallback(() => {
    setSearchExpanded(false);
    setSearchQuery("");
  }, []);

  const removeHistoryItem = useCallback((item: string) => {
    setSearchHistory((prev) => {
      const newHistory = prev.filter((h) => h !== item);
      saveSearchHistory(newHistory);
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    saveSearchHistory([]);
  }, []);

  const hash = (() => {
    const name = session?.user?.name || "";
    let h = 0;
    for (let i = 0; i < name.length; i++) {
      h = name.charCodeAt(i) + ((h << 5) - h);
    }
    return Math.abs(h);
  })();
  const avatarColor = AVATAR_COLORS[hash % AVATAR_COLORS.length];

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 sm:pointer-events-auto">
          <motion.span
            animate={{ width: searchExpanded ? 0 : "auto", opacity: searchExpanded ? 0 : 1 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden text-lg font-bold text-[#FB7299] sm:text-xl"
          >
            Bilibili
          </motion.span>
        </Link>

        <div ref={searchContainerRef} className="relative flex-1 sm:mx-4 sm:max-w-md">
          <AnimatePresence>
            {searchExpanded && (
              <motion.div
                key="mobile-search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-y-0 left-0 z-10 flex items-center bg-white dark:bg-black sm:hidden"
                style={{ right: "-40px" }}
              >
                <form onSubmit={handleSearch} className="w-full">
                  <div className="relative">
                    <input
                      ref={(el) => { if (el) mobileSearchInputRef.current = el; }}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      onFocus={handleSearchFocus}
                      onBlur={handleSearchBlur}
                      placeholder="搜索..."
                      className="w-full rounded-md border border-zinc-300 bg-zinc-100 px-4 py-1.5 pl-9 text-sm outline-none focus:border-[#FB7299] focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-[#FB7299] dark:focus:bg-zinc-700"
                    />
                    <button
                      type="submit"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      <Search size={16} suppressHydrationWarning />
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {!searchExpanded && (
            <div className="relative hidden w-full sm:block">
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    ref={(el) => { if (el) searchInputRef.current = el; }}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                    placeholder="搜索..."
                    className="w-full rounded-md border border-zinc-300 bg-zinc-100 px-4 py-1.5 pl-9 text-sm outline-none focus:border-[#FB7299] focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-[#FB7299] dark:focus:bg-zinc-700"
                  />
                  <button
                    type="submit"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <Search size={16} suppressHydrationWarning />
                  </button>
                </div>
              </form>

              <AnimatePresence>
                {searchFocused && searchHistory.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-500">搜索历史</span>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); clearHistory(); }}
                        className="text-xs text-zinc-400 hover:text-red-500"
                      >
                        清空历史
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {searchHistory.map((item) => (
                        <SearchHistoryBubble
                          key={item}
                          item={item}
                          onSelect={(q) => {
                            setSearchQuery(q);
                            addToHistory(q);
                            router.push(`/search?q=${encodeURIComponent(q)}`);
                            setSearchFocused(false);
                            setSearchExpanded(false);
                          }}
                          onRemove={removeHistoryItem}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <button
            onClick={openMobileSearch}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:hidden transition-opacity duration-200 ${searchExpanded ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          >
            <Search size={18} suppressHydrationWarning />
          </button>
          <button
            onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            {resolved === "dark" ? <Sun size={18} suppressHydrationWarning /> : <Moon size={18} suppressHydrationWarning />}
          </button>
          {session?.user ? (
            <>
              <Link
                href="/upload"
                className="rounded-md bg-[#FB7299] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#FC8AB1]"
              >
                投稿
              </Link>
              <div
                className="relative"
                ref={ref}
                onMouseEnter={showMenu}
                onMouseLeave={hideMenu}
              >
                <Link
                  href="/profile"
                  onClick={(e) => {
                    if (window.innerWidth < 640) {
                      e.preventDefault();
                      setOpen((prev) => !prev);
                    }
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white cursor-pointer transition-transform hover:scale-110 ${avatarColor}`}
                >
                  {session.user.name?.[0]}
                </Link>
                <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-10 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                    onMouseEnter={cancelHide}
                    onMouseLeave={hideMenu}
                  >
                    <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {session.user.name}
                      </p>
                    </div>
                    <a
                      href="/profile"
                      onClick={(e) => { e.preventDefault(); if (pathname !== "/profile") { router.push("/profile"); } }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      个人主页
                    </a>
                    <a
                      href="/profile#uploads"
                      onClick={(e) => { e.preventDefault(); if (pathname === "/profile") { window.location.hash = "uploads"; } else { window.location.href = "/profile#uploads"; } }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      我的投稿
                    </a>
                    <a
                      href="/profile#likes"
                      onClick={(e) => { e.preventDefault(); if (pathname === "/profile") { window.location.hash = "likes"; } else { window.location.href = "/profile#likes"; } }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                      </svg>
                      我的点赞
                    </a>
                    <a
                      href="/profile#favorites"
                      onClick={(e) => { e.preventDefault(); if (pathname === "/profile") { window.location.hash = "favorites"; } else { window.location.href = "/profile#favorites"; } }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                      </svg>
                      我的收藏
                    </a>
                    <a
                      href="/profile#comments"
                      onClick={(e) => { e.preventDefault(); if (pathname === "/profile") { window.location.hash = "comments"; } else { window.location.href = "/profile#comments"; } }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      我的评论
                    </a>
                    {session.user.name === "LZH" && (
                      <>
                        <div className="border-t border-zinc-100 dark:border-zinc-800" />
                        <a
                          href="/admin"
                          onClick={(e) => { e.preventDefault(); if (pathname !== "/admin") { router.push("/admin"); } }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-[#FB7299] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.204-.107-.397.165-.71.505-.78.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          管理面板
                        </a>
                      </>
                    )}

                    <a
                      href="/profile#settings"
                      onClick={(e) => { e.preventDefault(); if (pathname === "/profile") { window.location.hash = "settings"; } else { window.location.href = "/profile#settings"; } }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      用户设置
                    </a>
                    <button
                      onClick={async () => { await fetch("/api/auth/custom-signout", { method: "POST" }); window.location.reload(); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                      退出登录
                    </button>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => openLogin()}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                登录
              </button>
              <button
                onClick={openRegister}
                className="rounded-md bg-[#FB7299] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#FC8AB1]"
              >
                注册
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function SearchHistoryBubble({ item, onSelect, onRemove }: { item: string; onSelect: (q: string) => void; onRemove: (item: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setHovered(true), 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHovered(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect(item)}
      className="group relative rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 transition-colors hover:border-[#FB7299] hover:text-[#FB7299] cursor-pointer dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-[#FB7299]"
    >
      <span className="max-w-[120px] truncate">{item}</span>
      <AnimatePresence>
        {hovered && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.1 }}
            onClick={(e) => { e.stopPropagation(); onRemove(item); }}
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow"
          >
            <X size={10} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
