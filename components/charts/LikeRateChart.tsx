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
import type { Video } from "@/lib/types";

interface LikeRateChartProps {
  videos: Video[];
}

const BUCKETS = [
  { label: "0-2%", min: 0, max: 2, color: "#ef4444" },
  { label: "2-5%", min: 2, max: 5, color: "#f59e0b" },
  { label: "5-10%", min: 5, max: 10, color: "#e8c968" },
  { label: "10%+", min: 10, max: 100, color: "#10b981" },
];

export default function LikeRateChart({ videos }: LikeRateChartProps) {
  const data = BUCKETS.map((bucket) => {
    const count = videos.filter((v) => {
      if (!v.views || v.views === 0) return false;
      const rate = (v.likes / v.views) * 100;
      return rate >= bucket.min && rate < bucket.max;
    }).length;
    return { name: bucket.label, count, color: bucket.color };
  });

  const total = data.reduce((a, b) => a + b.count, 0);

  if (total === 0) {
    return (
      <p className="text-foreground/50 text-sm text-center py-8">
        No engagement data yet.
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
          formatter={(value: number | undefined) => [`${value ?? 0} videos`, "Count"]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
