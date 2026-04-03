export default function ContractsLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-24 rounded-md bg-white/20 animate-pulse" />
            <div className="h-3 w-16 rounded-md bg-white/10 animate-pulse" />
          </div>
          <div className="h-9 w-32 rounded-full bg-white/10 animate-pulse" />
        </div>
        {/* Search bar skeleton */}
        <div className="mt-3 h-10 rounded-xl bg-white/10 animate-pulse" />
      </header>

      <main className="px-4 py-4 space-y-3 pb-24">
        {/* Status filter pills */}
        <div className="flex gap-2 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-20 flex-shrink-0 rounded-full bg-slate-200 animate-pulse" />
          ))}
        </div>

        {/* Contract rows */}
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-36 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="space-y-1.5 items-end flex flex-col">
                <div className="h-4 w-20 rounded bg-slate-200 animate-pulse" />
                <div className="h-5 w-16 rounded-full bg-slate-100 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
