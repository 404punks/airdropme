import type { PointComponent } from "@/server/points/calculate";
import { formatNumber } from "@/lib/utils";

const barColor: Record<PointComponent["key"], string> = {
  followers: "bg-blue",
  callouts: "bg-violet",
  likes: "bg-[#7aa2ff]",
  reposts: "bg-[#6d5efc]",
};

export function PointsChart({ components }: { components: PointComponent[] }) {
  const max = Math.max(1, ...components.map((item) => (item.included ? item.points : 0)));
  return (
    <div className="space-y-5">
      <div className="space-y-4" role="img" aria-label="Points by category">
        {components.map((item) => {
          const width = item.included ? (item.points / max) * 100 : 0;
          return (
            <div key={item.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span>{item.label}</span>
                <span className="tabular-nums text-mute">{item.included ? `${formatNumber(item.points)} PTS` : item.status}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ink">
                <div className={`h-full rounded-full ${barColor[item.key]}`} style={{ width: `${width}%` }} />
              </div>
              <p className="mt-1 text-xs text-mute">{item.reason}</p>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Point values for each public statistic</caption>
          <thead className="text-mute">
            <tr>
              <th className="py-2 font-medium">Category</th>
              <th className="font-medium">Status</th>
              <th className="font-medium">Counted</th>
              <th className="font-medium">Weight</th>
              <th className="font-medium">PTS</th>
            </tr>
          </thead>
          <tbody>
            {components.map((item) => (
              <tr key={item.key} className="border-t border-line">
                <td className="py-2">{item.label}</td>
                <td className="capitalize">{item.status}</td>
                <td className="tabular-nums">{item.included ? formatNumber(item.counted) : "—"}</td>
                <td className="tabular-nums">{item.weight}</td>
                <td className="tabular-nums">{item.included ? formatNumber(item.points) : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
