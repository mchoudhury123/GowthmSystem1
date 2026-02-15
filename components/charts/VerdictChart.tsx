"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface VerdictChartProps {
  verdictCounts: { REPEAT: number; MODIFY: number; STOP: number };
}

const COLORS: Record<string, string> = {
  Repeat: "#10b981",
  Modify: "#f59e0b",
  Stop: "#ef4444",
};

export default function VerdictChart({ verdictCounts }: VerdictChartProps) {
  const data = [
    { name: "Repeat", value: verdictCounts.REPEAT },
    { name: "Modify", value: verdictCounts.MODIFY },
    { name: "Stop", value: verdictCounts.STOP },
  ];

  const total = data.reduce((a, b) => a + b.value, 0);

  if (total === 0) {
    return (
      <p className="text-foreground/50 text-sm text-center py-8">
        No analyzed videos yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
        <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} />
        <YAxis stroke="#666" fontSize={11} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#141414",
            border: "1px solid #242424",
            borderRadius: 8,
            color: "#f5f5f5",
          }}
          formatter={(value: number | undefined, name: string | undefined) => [
            `${value ?? 0} (${total > 0 ? Math.round(((value ?? 0) / total) * 100) : 0}%)`,
            name ?? "",
          ]}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={COLORS[entry.name]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
