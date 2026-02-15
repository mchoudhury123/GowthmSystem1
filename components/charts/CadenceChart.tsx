"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Video } from "@/lib/types";

interface CadenceChartProps {
  videos: Video[];
}

export default function CadenceChart({ videos }: CadenceChartProps) {
  // Group videos by week
  const weekMap: Record<string, number> = {};

  for (const v of videos) {
    const date = new Date(v.created_at_ts || v.created_at);
    // Get Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const weekKey = monday.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
  }

  const data = Object.entries(weekMap)
    .slice(-8) // Last 8 weeks
    .map(([week, count]) => ({ week, videos: count }));

  if (data.length === 0) {
    return (
      <p className="text-foreground/50 text-sm text-center py-8">
        No posting data yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
        <XAxis dataKey="week" stroke="#666" fontSize={11} tickLine={false} />
        <YAxis stroke="#666" fontSize={11} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#141414",
            border: "1px solid #242424",
            borderRadius: 8,
            color: "#f5f5f5",
          }}
          formatter={(value: number | undefined) => [`${value ?? 0} videos`, "Posted"]}
        />
        <Bar dataKey="videos" fill="#d4af37" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
