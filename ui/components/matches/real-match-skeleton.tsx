export function RealMatchSkeleton() {
  return (
    <div className="relative bg-black/30 backdrop-blur-xl border border-purple-500/10 rounded-3xl p-8 shadow-lg animate-pulse">
      <div className="h-6 w-40 bg-white/10 rounded-full mb-6" />
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 bg-white/5 rounded-2xl border border-white/10" />
        ))}
      </div>
      <div className="h-5 bg-white/10 rounded-full w-56 mb-3" />
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-8 w-24 bg-white/5 rounded-full border border-white/10" />
        ))}
      </div>
    </div>
  );
}
