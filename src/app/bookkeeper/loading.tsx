export default function BookkeeperLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-32 rounded-md bg-white/20 animate-pulse" />
            <div className="h-3 w-24 rounded-md bg-white/10 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 pb-24">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-3 space-y-1.5">
              <div className="h-3 w-16 rounded bg-slate-200 animate-pulse" />
              <div className="h-6 w-20 rounded bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Section toggles */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
              <div className="h-6 w-6 rounded bg-slate-100 animate-pulse" />
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
