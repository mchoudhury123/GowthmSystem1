"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface FollowersChartProps {
  days: string[];
  followers: number[];
}

export default function FollowersChart({ days, followers }: FollowersChartProps) {
  const data = days.map((day, i) => ({
    day: new Date(day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    followers: followers[i],
  }));

  if (data.length === 0) {
    return (
      <p className="text-foreground/50 text-sm text-center py-8">
        No follower data yet. Ingest your profile to start tracking.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
        <XAxis
          dataKey="day"
          stroke="#666"
          fontSize={11}
          tickLine={false}
        />
        <YAxis
          stroke="#666"
          fontSize={11}
          tickLine={false}
          tickFormatter={(v) =>
            v >= 1000000
              ? `${(v / 1000000).toFixed(1)}M`
              : v >= 1000
                ? `${(v / 1000).toFixed(0)}K`
                : v.toString()
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#141414",
            border: "1px solid #242424",
            borderRadius: 8,
            color: "#f5f5f5",
          }}
          labelStyle={{ color: "#f5f5f5" }}
          formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), "Followers"]}
        />
        <Line
          type="monotone"
          dataKey="followers"
          stroke="#d4af37"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#d4af37" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
