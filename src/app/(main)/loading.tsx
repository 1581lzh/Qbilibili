export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
      <div className="mb-4 h-6 w-24 rounded bg-zinc-200 dark:bg-zinc-800 sm:mb-6 sm:h-8 sm:w-32 animate-pulse" />
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-video rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-1 flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
