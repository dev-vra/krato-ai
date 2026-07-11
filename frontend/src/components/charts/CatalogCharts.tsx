import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoryColor, categoryLabel, SPHERE_COLOR, SPHERE_LABEL } from "@/lib/labels";
import type { Sphere, Stats } from "@/lib/types";

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <div className="font-semibold text-ink">{label ?? payload[0].name}</div>
      <div className="mt-0.5 text-ink-soft">
        {payload[0].value} {payload[0].value === 1 ? "fonte" : "fontes"}
      </div>
    </div>
  );
}

export function SphereDonut({ stats }: { stats: Stats }) {
  const data = Object.entries(stats.by_sphere).map(([k, v]) => ({
    name: SPHERE_LABEL[k as Sphere] ?? k,
    key: k,
    value: v,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={90}
          paddingAngle={3}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.key} fill={SPHERE_COLOR[d.key as Sphere] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip content={<GlassTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryBars({ stats }: { stats: Stats }) {
  const data = Object.entries(stats.by_category)
    .map(([k, v]) => ({ key: k, name: categoryLabel(k), value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={128}
          tick={{ fontSize: 12, fill: "#3b4763" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: "rgba(106,92,240,0.06)" }} content={<GlassTooltip />} />
        <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={16}>
          {data.map((d) => (
            <Cell key={d.key} fill={categoryColor(d.key)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
