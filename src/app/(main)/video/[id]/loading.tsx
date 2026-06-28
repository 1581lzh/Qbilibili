export default function VideoLoading() {
  return (
    <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="aspect-video animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-3 sm:mt-4">
            <div className="h-6 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800 sm:h-8 animate-pulse" />
            <div className="mt-2 flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
              <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            </div>
            <div className="mt-3 flex gap-2 sm:mt-4 sm:gap-3">
              <div className="h-9 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
              <div className="h-9 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:mt-6 sm:pt-6">
            <div className="mb-3 h-5 w-20 rounded bg-zinc-200 dark:bg-zinc-800 sm:mb-4 animate-pulse" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                  <div className="mt-2 h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="mb-3 h-5 w-16 rounded bg-zinc-200 dark:bg-zinc-800 sm:mb-4 animate-pulse" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2 animate-pulse">
                <div className="h-20 w-32 flex-shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
