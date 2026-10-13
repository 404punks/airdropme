import type { PointComponent } from "@/server/points/calculate";

export function PointsChart({ components }: { components: PointComponent[] }) {
  const max = Math.max(1, ...components.map((item) => item.points));
  return (
    <div className="space-y-3" role="img" aria-label="Points breakdown">
      {components.map((item) => (
        <div key={item.key}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{item.label}</span>
            <span className="text-mute">{item.included ? item.points.toLocaleString() : item.status}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet to-acid"
              style={{ width: `${item.included ? Math.max(4, (item.points / max) * 100) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
