export default function LeaderboardLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2.5">
        <div className="h-8 w-28 rounded-pill liquid-glass-card-lite animate-pulse" />
        <div className="h-9 w-56 rounded-xl liquid-glass-card-lite animate-pulse" />
      </div>
      <div className="liquid-glass-card p-5 space-y-3">
        <div className="h-5 w-44 rounded-lg bg-slate-200/70 dark:bg-white/10 animate-pulse" />
        <div className="h-14 rounded-2xl bg-slate-200/60 dark:bg-white/10 animate-pulse" />
        <div className="h-14 rounded-2xl bg-slate-200/60 dark:bg-white/10 animate-pulse" />
        <div className="h-14 rounded-2xl bg-slate-200/60 dark:bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}
