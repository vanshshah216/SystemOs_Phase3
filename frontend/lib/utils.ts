// lib/utils.ts – Shared utility functions

export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (bytes == null || isNaN(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatBytesPerSec(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  return `${formatBytes(bytes)}/s`;
}

export function formatPct(val: number | null | undefined, decimals = 1): string {
  if (val == null || isNaN(val)) return "—";
  return `${val.toFixed(decimals)}%`;
}

export function formatZscore(z: number | null | undefined): string {
  if (z == null) return "—";
  const sign = z >= 0 ? "+" : "";
  return `${sign}${z.toFixed(2)}σ`;
}

export function formatTimestamp(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString();
}

export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export function formatDuration(startTs: number, endTs: number | null): string {
  const end = endTs ?? Date.now() / 1000;
  const secs = Math.round(end - startTs);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "HIGH":   return "text-red-400";
    case "MEDIUM": return "text-yellow-400";
    case "LOW":    return "text-blue-400";
    default:       return "text-gray-400";
  }
}

export function severityBg(severity: string): string {
  switch (severity) {
    case "HIGH":   return "bg-red-500/10 border-red-500/30";
    case "MEDIUM": return "bg-yellow-500/10 border-yellow-500/30";
    case "LOW":    return "bg-blue-500/10 border-blue-500/30";
    default:       return "bg-gray-500/10 border-gray-500/30";
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "healthy":  return "text-emerald-400";
    case "warning":  return "text-yellow-400";
    case "critical": return "text-red-400";
    default:         return "text-gray-400";
  }
}

export function getDeviationLabel(zscore: number | null | undefined): {
  label: string; color: string;
} {
  if (zscore == null) return { label: "Unknown", color: "text-gray-400" };
  const abs = Math.abs(zscore);
  if (abs < 1.0) return { label: "Normal",    color: "text-emerald-400" };
  if (abs < 2.0) return { label: "Elevated",  color: "text-yellow-400" };
  if (abs < 3.0) return { label: "Unusual",   color: "text-orange-400" };
  return           { label: "Critical",  color: "text-red-400" };
}

export function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 10)   return "just now";
  if (diff < 60)   return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// Convert a Unix timestamp range label to seconds offset from now
export function timeRangeToSeconds(label: string): number {
  const map: Record<string, number> = {
    "5m":  300,
    "15m": 900,
    "30m": 1800,
    "1h":  3600,
    "6h":  21600,
    "24h": 86400,
  };
  return map[label] ?? 3600;
}
