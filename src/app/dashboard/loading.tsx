export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-[#010F21] px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-32 rounded-md bg-white/20 animate-pulse" />
            <div className="h-3 w-20 rounded-md bg-white/10 animate-pulse" />
          </div>
          <div className="h-9 w-28 rounded-full bg-white/10 animate-pulse" />
        </div>
      </header>

      <main className="px-4 py-5 space-y-5 pb-24">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100">
              <div className="h-3 w-20 rounded bg-slate-200 animate-pulse mb-2" />
              <div className="h-7 w-28 rounded bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Section: Contracts */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <div className="space-y-1.5">
                <div className="h-3.5 w-32 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="h-4 w-16 rounded bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Section: Leads */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
              <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 w-28 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
