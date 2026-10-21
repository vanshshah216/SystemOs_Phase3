"use client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import { formatTimestamp } from "@/lib/utils";
import type { HistoryPoint } from "@/types";

interface MetricChartProps {
  data: HistoryPoint[];
  color?: string;
  label?: string;
  unit?: string;
  baseline?: number | null;
  height?: number;
  formatY?: (v: number) => string;
  anomalyThreshold?: number | null;
}

const CustomTooltip = ({ active, payload, label, unit = "", formatY }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <div className="text-gray-400 mb-1">{formatTimestamp(Number(label))}</div>
      <div className="text-white font-semibold">
        {formatY ? formatY(val) : `${val?.toFixed(1)}${unit}`}
      </div>
    </div>
  );
};

export default function MetricChart({
  data,
  color = "#34d399",
  label = "",
  unit = "",
  baseline,
  height = 160,
  formatY,
  anomalyThreshold,
}: MetricChartProps) {
  if (!data.length) {
    return (
      <div className={`flex items-center justify-center text-gray-600 text-xs font-mono`} style={{ height }}>
        Collecting data…
      </div>
    );
  }

  const chartData = data.map(d => ({ t: d.timestamp, v: d.value }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis
          dataKey="t"
          tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "monospace" }}
          tickFormatter={v => formatTimestamp(v)}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          width={36}
          tickFormatter={v => formatY ? formatY(v) : `${v}${unit}`}
        />
        <Tooltip content={<CustomTooltip unit={unit} formatY={formatY} />} />

        {/* Baseline reference line */}
        {baseline != null && (
          <ReferenceLine
            y={baseline}
            stroke="#6b7280"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{ value: "baseline", fill: "#6b7280", fontSize: 8, fontFamily: "monospace" }}
          />
        )}

        {/* Anomaly threshold */}
        {anomalyThreshold != null && (
          <ReferenceLine
            y={anomalyThreshold}
            stroke="#f97316"
            strokeDasharray="3 2"
            strokeWidth={1}
            label={{ value: "P95", fill: "#f97316", fontSize: 8 }}
          />
        )}

        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: color }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
