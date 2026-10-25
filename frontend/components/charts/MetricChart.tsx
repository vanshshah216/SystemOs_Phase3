"use client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import { formatTimestamp } from "@/lib/utils";
import type { HistoryPoint } from "@/types";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: number | string;
  unit?: string;
  formatY?: (value: number) => string;
}

interface MetricChartProps {
  data: HistoryPoint[];
  color?: string;
  label?: string;
  unit?: string;
  baseline?: number | null;
  height?: number;
  formatY?: (v: number) => string;
  anomalyThreshold?: number | null;
  error?: string | null;
}

const CustomTooltip = ({ active, payload, label, unit = "", formatY }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const rawValue = payload[0]?.value;
  const val = typeof rawValue === "number" ? rawValue : Number(rawValue);
  return (
    <div className="bg-white/95 backdrop-blur-xl border border-[#E5EAF1] rounded-xl px-3.5 py-2 text-xs font-mono shadow-xl text-[#172033]">
      <div className="text-[#667085] text-[11px] mb-1 font-sans">{formatTimestamp(Number(label))}</div>
      <div className="text-[#172033] font-bold text-sm">
        {formatY ? formatY(val) : `${val.toFixed(1)}${unit}`}
      </div>
    </div>
  );
};

export default function MetricChart({
  data,
  color = "#2563EB",
  label = "",
  unit = "",
  baseline,
  height = 160,
  formatY,
  anomalyThreshold,
  error,
}: MetricChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-[#98A2B3] text-xs font-mono" style={{ height }}>
        {error ? `Telemetry unavailable: ${error}` : "Collecting baseline data…"}
      </div>
    );
  }

  const chartData = data.map(d => ({ t: d.timestamp, v: d.value }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF1" vertical={false} />
        <XAxis
          dataKey="t"
          tick={{ fill: "#667085", fontSize: 10, fontFamily: "monospace" }}
          tickFormatter={v => formatTimestamp(v)}
          tickLine={false}
          axisLine={{ stroke: "#E5EAF1" }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#667085", fontSize: 10, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          width={38}
          tickFormatter={v => formatY ? formatY(v) : `${v}${unit}`}
        />
        <Tooltip content={<CustomTooltip unit={unit} formatY={formatY} />} />

        {/* Baseline reference line */}
        {baseline != null && (
          <ReferenceLine
            y={baseline}
            stroke="#94A3B8"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{ value: "baseline", fill: "#667085", fontSize: 9, fontFamily: "monospace", position: "insideTopRight" }}
          />
        )}

        {/* Anomaly threshold */}
        {anomalyThreshold != null && (
          <ReferenceLine
            y={anomalyThreshold}
            stroke="#DC2626"
            strokeDasharray="3 2"
            strokeWidth={1}
            label={{ value: "P95", fill: "#DC2626", fontSize: 9, fontFamily: "monospace", position: "insideTopRight" }}
          />
        )}

        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: "#FFFFFF", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
