export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-24 rounded-md bg-white/20 animate-pulse" />
            <div className="h-3 w-20 rounded-md bg-white/10 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="px-5 py-6 space-y-5 max-w-2xl mx-auto pb-24">
        {/* Period pills */}
        <div className="flex gap-2 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 w-20 flex-shrink-0 rounded-full bg-slate-200 animate-pulse" />
          ))}
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
              <div className="h-3 w-20 rounded bg-slate-200 animate-pulse" />
              <div className="h-7 w-24 rounded bg-slate-200 animate-pulse" />
              <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Table cards */}
        {[...Array(3)].map((_, s) => (
          <div key={s} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                <div className="h-3.5 w-32 rounded bg-slate-200 animate-pulse" />
                <div className="h-3.5 w-16 rounded bg-slate-200 animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </main>
    </div>
  );
}
