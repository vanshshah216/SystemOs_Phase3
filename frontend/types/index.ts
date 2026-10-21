// types/index.ts – Shared TypeScript types matching backend API

export interface MetricContext {
  has_baseline: boolean;
  mean?: number | null;
  std?: number | null;
  zscore?: number | null;
  percentile_50?: number | null;
  percentile_90?: number | null;
  percentile_95?: number | null;
  percentile_99?: number | null;
  trend_slope?: number | null;
  is_anomaly?: boolean;
  anomaly_reason?: string | null;
  history_samples?: number;
  consecutive_anomalies?: number;
  is_sustained?: boolean;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  memory_bytes: number | null;
  threads: number | null;
  io_read_bytes: number | null;
  io_write_bytes: number | null;
}

export interface SystemMetric {
  timestamp: number;
  overall_status: "healthy" | "warning" | "critical";
  cpu_percent: number | null;
  cpu_user: number | null;
  cpu_system: number | null;
  cpu_iowait: number | null;
  ram_used: number | null;
  ram_available: number | null;
  ram_percent: number | null;
  disk_read_bytes: number | null;
  disk_write_bytes: number | null;
  network_sent_bytes: number | null;
  network_recv_bytes: number | null;
  cpu_context: MetricContext | null;
  ram_context: MetricContext | null;
  disk_read_context: MetricContext | null;
  net_context: MetricContext | null;
  top_processes: ProcessInfo[];
  baseline_sample_count: number;
  persistence_n: number;
}

export interface HistoryPoint {
  timestamp: number;
  value: number | null;
}

export type MetricKey =
  | "cpu_percent" | "cpu_user" | "cpu_system" | "cpu_iowait"
  | "ram_used" | "ram_available" | "ram_percent"
  | "disk_read_bytes" | "disk_write_bytes"
  | "network_sent_bytes" | "network_recv_bytes";

export interface EvidenceStrength {
  score: number;
  A?: number;
  P?: number;
  C?: number;
  R?: number;
  T?: number;
  components?: Record<string, string>;
}

export interface DiagnosisEvent {
  id: number;
  start_time: number;
  end_time: number | null;
  severity: "HIGH" | "MEDIUM" | "LOW";
  probable_cause: string;
  primary_process: string | null;
  status: "active" | "resolved";
  created_at: number;
  is_demo: boolean;
  evidence?: {
    evidence_items: string[];
    evidence_strength: EvidenceStrength;
    raw_stats: Record<string, number | string | null>;
  };
}

export interface AppSettings {
  sampling_interval: string;
  rolling_window: string;
  zscore_threshold: string;
  persistence_n: string;
  percentile_threshold: string;
}

// ── Phase 3 Process Analyzer & Recommendation Types ────────────────────────────

export type ProcessActivityClass =
  | "Active application"
  | "High resource consumer"
  | "Background process"
  | "Protected/system process"
  | "Review candidate"
  | "Insufficient information";

export type ProcessSafetyTier =
  | "protected_system"
  | "review_with_caution"
  | "safe_to_review"
  | "uncertain";

export interface ProcessRecommendation {
  id: string;
  pid: number;
  name: string;
  category: string;
  classification: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  safety_tier: ProcessSafetyTier;
  reclaimable_memory_mb: number;
  reclaimable_cpu_percent: number;
  what_process_is_doing: string;
  activity_description: string;
  resources_consumed: string;
  is_usage_unusual: string;
  classification_reason: string;
  should_investigate: string;
  investigation_advice: string;
  manual_closure_considered: string;
  manual_closure_guidance: string;
  safety_and_uncertainty: string;
  evidence: string[];
}

export interface ProcessProfile {
  pid: number;
  name: string;
  ppid: number | null;
  parent_name: string | null;
  status: string;
  create_time: number | null;
  runtime_seconds: number;
  cpu_percent: number | null;
  cpu_percent_raw: number | null;
  memory_percent: number | null;
  memory_bytes: number | null;
  memory_vms_bytes: number | null;
  memory_mb: number;
  threads: number;
  io_read_bytes: number | null;
  io_write_bytes: number | null;
  open_connections: number;
  established_connections: number;
  listening_ports: number;
  is_foreground: boolean;
  foreground_window_title: string | null;
  activity_class: ProcessActivityClass;
  activity_label: string;
  activity_key: string;
  safety_tier: ProcessSafetyTier;
  is_system: boolean;
  attributed_events: Array<{
    id: number;
    severity: string;
    probable_cause: string;
    start_time: number;
  }>;
  trends: Record<string, any>;
  is_accessible: boolean;
}

export interface ProcessAnalyzerSummary {
  total_analyzed: number;
  total_system_processes: number;
  active_application_count: number;
  high_resource_consumer_count: number;
  background_process_count: number;
  protected_system_count: number;
  review_candidate_count: number;
  insufficient_information_count: number;
  total_memory_tracked_mb: number;
  idle_memory_mb: number;
  potential_reclaimable_memory_mb: number;
  recommendations_count: number;
  cpu_core_count: number;
  network_metrics_supported: boolean;
  network_metrics_description: string;
}

export interface ProcessCategoryBreakdown {
  label: string;
  count: number;
  memory_mb: number;
  avg_cpu: number;
}

export interface ProcessAnalyzerResponse {
  summary: ProcessAnalyzerSummary;
  recommendations: ProcessRecommendation[];
  processes: ProcessProfile[];
  categories_breakdown: Record<string, ProcessCategoryBreakdown>;
}

