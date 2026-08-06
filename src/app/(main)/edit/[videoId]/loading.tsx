export default function EditVideoLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 py-8 dark:bg-zinc-900">
      <div className="mx-auto max-w-2xl px-4">
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-800">
          <div className="mb-6 h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />

          <div className="mb-4">
            <div className="mb-2 h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>

          <div className="mb-4">
            <div className="mb-2 h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-24 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>

          <div className="mb-4">
            <div className="mb-2 h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-32 w-48 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>

          <div className="flex gap-3">
            <div className="h-10 flex-1 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-10 flex-1 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
