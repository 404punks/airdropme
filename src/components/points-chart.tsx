import { UsdcAmount, UsdcWord } from "@/components/usdc-amount";
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
      <div className="space-y-4" role="img" aria-label="USDC by category">
        {components.map((item) => {
          const width = item.included ? (item.points / max) * 100 : 0;
          return (
            <div key={item.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span>{item.label}</span>
                <span className="text-mute">{item.included ? <UsdcAmount points={item.points} /> : item.status}</span>
              </div>
              <div className="h-2 overflow-hidden bg-ink">
                <div className={`h-full ${barColor[item.key]}`} style={{ width: `${width}%` }} />
              </div>
              <p className="mt-1 text-xs text-mute">{item.reason}</p>
            </div>
          );
        })}
      </div>
      <ul className="space-y-2 md:hidden">
        {components.map((item) => (
          <li key={item.key} className="grid grid-cols-2 gap-x-3 gap-y-1 border border-line p-3 text-sm">
            <p className="col-span-2 font-medium">{item.label}</p>
            <p className="text-mute">Status</p>
            <p className="text-right capitalize">{item.status}</p>
            <p className="text-mute">Counted</p>
            <p className="text-right tabular-nums">{item.included ? formatNumber(item.counted) : "—"}</p>
            <p className="text-mute">Rate</p>
            <p className="text-right"><UsdcAmount points={item.weight} /></p>
            <p className="text-mute"><UsdcWord /></p>
            <p className="text-right">{item.included ? <UsdcAmount points={item.points} /> : <UsdcAmount points={0} />}</p>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Point values for each public statistic</caption>
          <thead className="text-mute">
            <tr>
              <th className="py-2 font-medium">Category</th>
              <th className="font-medium">Status</th>
              <th className="font-medium">Counted</th>
              <th className="font-medium">Rate</th>
              <th className="font-medium"><UsdcWord /></th>
            </tr>
          </thead>
          <tbody>
            {components.map((item) => (
              <tr key={item.key} className="border-t border-line">
                <td className="py-2">{item.label}</td>
                <td className="capitalize">{item.status}</td>
                <td className="tabular-nums">{item.included ? formatNumber(item.counted) : "—"}</td>
                <td><UsdcAmount points={item.weight} /></td>
                <td>{item.included ? <UsdcAmount points={item.points} /> : <UsdcAmount points={0} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
