"use client";

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-divider)", background: "var(--color-surface-2)" }}>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <div className="h-3 w-16 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row} style={{ borderBottom: "1px solid var(--color-divider)" }}>
                {Array.from({ length: columns }).map((_, col) => (
                  <td key={col} className="px-4 py-4">
                    <div
                      className="animate-pulse rounded"
                      style={{
                        background: "var(--color-surface-offset)",
                        height: col === 0 ? "12px" : "10px",
                        width: col === 0 ? "80%" : "60%",
                        animationDelay: `${row * 80 + col * 40}ms`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-xl" style={{ background: "var(--color-surface-offset)" }} />
        <div className="flex-1">
          <div className="mb-1.5 h-3 w-24 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
          <div className="h-2 w-16 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
        </div>
      </div>
      <div className="mb-2 h-6 w-32 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
      <div className="h-3 w-20 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-32 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
        <div className="h-3 w-20 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
      </div>
      <div className="relative h-48 w-full overflow-hidden rounded-xl" style={{ background: "var(--color-surface)" }}>
        {/* Fake chart line */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path
            d="M0 150 Q50 130 100 140 Q150 100 200 110 Q250 80 300 90 Q350 60 400 70"
            fill="none"
            stroke="var(--color-surface-offset)"
            strokeWidth="3"
            className="animate-pulse"
          />
        </svg>
      </div>
    </div>
  );
}

export function PredictionSkeleton() {
  return (
    <div className="space-y-4">
      <CardGridSkeleton count={2} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card flex items-center justify-center p-8">
          <div className="h-40 w-40 animate-pulse rounded-full" style={{ background: "var(--color-surface-offset)" }} />
        </div>
        <div className="card flex items-center justify-center p-8">
          <div className="h-28 w-48 animate-pulse rounded-xl" style={{ background: "var(--color-surface-offset)" }} />
        </div>
        <div className="card p-6">
          <div className="mb-4 h-4 w-24 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mb-3 flex items-center justify-between">
              <div className="h-3 w-20 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
              <div className="h-3 w-12 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NewsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <div className="mb-2 flex items-center gap-3">
            <div className="h-2.5 w-20 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
            <div className="h-2.5 w-16 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
            <div className="h-4 w-14 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
          </div>
          <div className="mb-2 h-4 w-3/4 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
          <div className="mb-3 h-3 w-full animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
          <div className="flex gap-2">
            <div className="h-4 w-12 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
            <div className="h-4 w-16 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
