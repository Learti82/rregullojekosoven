"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryBreakdown, TrendPoint } from "@/types";

/**
 * Dashboard charts.
 *
 * Colours come from the CSS variables in `globals.css`, so both themes are
 * handled without a JS theme lookup. Axis labels are shortened for mobile.
 */

const axisStyle = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
};

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-elevated">
      {label ? <p className="mb-1 font-medium text-popover-foreground">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          {entry.name}:{" "}
          <span className="font-semibold text-popover-foreground tabular-nums">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.every((point) => point.created === 0 && point.completed === 0)) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Ende nuk ka të dhëna për këtë periudhë.
      </p>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="created-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="completed-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: string) => value.slice(5).replace("-", "/")}
            minTickGap={24}
          />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <Tooltip content={<TooltipBox />} />

          <Area
            type="monotone"
            dataKey="created"
            name="Të raportuara"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fill="url(#created-fill)"
          />
          <Area
            type="monotone"
            dataKey="completed"
            name="Të zgjidhura"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            fill="url(#completed-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }: { data: CategoryBreakdown[] }) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Ende nuk ka raporte për të analizuar.
      </p>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            width={96}
          />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey="count" name="Raporte" radius={[0, 6, 6, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
