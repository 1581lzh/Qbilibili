export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex items-center gap-4 animate-pulse">
        <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-2">
          <div className="h-6 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="mt-6 flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
        {["投稿", "收藏", "点赞", "评论"].map((tab) => (
          <div key={tab} className="h-10 w-16 rounded-t bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
