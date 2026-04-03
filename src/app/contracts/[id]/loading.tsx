export default function ContractDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#010F21] px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-5 w-28 rounded-md bg-white/20 animate-pulse" />
            <div className="h-3 w-20 rounded-md bg-white/10 animate-pulse" />
          </div>
          <div className="h-6 w-16 rounded-full bg-white/10 animate-pulse" />
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 max-w-2xl mx-auto pb-24">
        {/* Customer card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-12 rounded bg-slate-100 animate-pulse" />
                <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Line items card */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
          </div>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-slate-50">
              <div className="space-y-1">
                <div className="h-3.5 w-32 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="h-4 w-16 rounded bg-slate-200 animate-pulse" />
            </div>
          ))}
          {/* Totals */}
          <div className="px-4 py-3 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-14 rounded bg-slate-200 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Payments card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50">
              <div className="space-y-1">
                <div className="h-3.5 w-24 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="h-4 w-14 rounded bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
