"use client";
import { useState, useEffect } from "react";
import TopBar from "@/components/layout/TopBar";
import { api } from "@/lib/api";
import { useHealth } from "@/hooks/useMetrics";
import type { AppSettings } from "@/types";
import { Loader2, Save, RotateCcw, Radio, Database, Server, Shield } from "lucide-react";
import Tooltip from "@/components/common/Tooltip";

const FIELDS: { key: keyof AppSettings; label: string; desc: string; min: number; max: number; step: number; unit: string; tooltipTerm?: string }[] = [
  {
    key: "sampling_interval",
    label: "Sampling Interval",
    desc: "Frequency at which the collector gathers hardware performance snapshots.",
    min: 1, max: 30, step: 1, unit: "seconds",
  },
  {
    key: "rolling_window",
    label: "Rolling Baseline Window",
    desc: "Count of historical healthy samples utilized to calibrate the dynamic mean.",
    min: 30, max: 1000, step: 10, unit: "samples", tooltipTerm: "baseline",
  },
  {
    key: "zscore_threshold",
    label: "Z-Score Anomaly Threshold",
    desc: "Standard deviations above historical mean required to trigger an anomaly flag.",
    min: 1.0, max: 5.0, step: 0.1, unit: "σ", tooltipTerm: "zscore",
  },
  {
    key: "persistence_n",
    label: "Persistence Requirement (N)",
    desc: "Consecutive anomalous windows required before establishing a persistent event.",
    min: 2, max: 20, step: 1, unit: "consecutive samples", tooltipTerm: "persistence",
  },
  {
    key: "percentile_threshold",
    label: "Percentile Threshold",
    desc: "Historical percentile boundary (e.g. 95 = P95) used as corroborating ceiling.",
    min: 80, max: 99, step: 1, unit: "th percentile", tooltipTerm: "percentile",
  },
];

const DEFAULTS: AppSettings = {
  sampling_interval: "3",
  rolling_window: "300",
  zscore_threshold: "2.0",
  persistence_n: "4",
  percentile_threshold: "95",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { health, error: healthError } = useHealth();

  useEffect(() => {
    api.getSettings()
      .then(s => { setSettings(s); setDirty(false); })
      .catch((error: unknown) => {
        setMessage({
          type: "error",
          text: error instanceof Error ? `Unable to load settings: ${error.message}` : "Unable to load settings",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: keyof AppSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, number> = {};
      for (const f of FIELDS) body[f.key] = parseFloat(settings[f.key]);
      const res = await api.updateSettings(body);
      setSettings(res.current);
      setDirty(false);
      setMessage({ type: "success", text: "Settings saved. Sampling interval changes take effect on the next collection cycle." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Settings API unavailable";
      setMessage({ type: "error", text: `Error updating settings: ${message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
    setDirty(true);
    setMessage(null);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFCFF]">
      <TopBar title="Settings" subtitle="System Configuration" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033] font-sans">
            System settings
          </h2>
          <p className="text-sm text-[#667085] font-sans mt-1">
            Configure telemetry sampling frequencies, rolling baseline windows, and anomaly thresholds.
          </p>
        </div>

        {/* System Service Health Status Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm shadow-slate-200/50 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-sans font-medium">Collector Daemon</div>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                  {health?.collector_running ? "Running" : healthError ? "Unavailable" : "Stopped"}
                </div>
              </div>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${health?.collector_running ? "bg-emerald-500" : "bg-rose-500"}`} />
          </div>

          <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm shadow-slate-200/50 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-sans font-medium">SQLite Database</div>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                  {health?.database_ok ? "Connected" : "Error"}
                </div>
              </div>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${health?.database_ok ? "bg-emerald-500" : "bg-rose-500"}`} />
          </div>

          <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm shadow-slate-200/50 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-sans font-medium">REST API Service</div>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                  Healthy
                </div>
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* Configuration Sliders & Fields */}
        <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-[#172033] font-sans">
              Mathematical Parameters
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              These values govern the rolling statistical baseline, Z-score anomaly detector, and persistence state machines.
            </p>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center text-xs font-mono text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 mr-2" /> Loading parameter set...
            </div>
          ) : (
            <div className="space-y-5">
              {FIELDS.map(f => (
                <div key={f.key} className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <label className="text-sm font-semibold text-slate-900 font-sans flex items-center">
                        {f.label}
                        {f.tooltipTerm && <Tooltip term={f.tooltipTerm} explanation="" />}
                      </label>
                      <p className="text-xs text-slate-500 font-sans mt-0.5">{f.desc}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-bold font-mono text-blue-600">
                        {settings[f.key]}
                      </span>
                      <span className="text-xs font-mono text-slate-500 ml-1.5">{f.unit}</span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={parseFloat(settings[f.key]) || f.min}
                    onChange={e => handleChange(f.key, e.target.value)}
                    className="w-full h-2 rounded-lg bg-slate-200 appearance-none cursor-pointer accent-blue-600"
                  />

                  <div className="flex justify-between text-[11px] font-mono text-slate-500">
                    <span>Min: {f.min} {f.unit}</span>
                    <span>Max: {f.max} {f.unit}</span>
                  </div>
                </div>
              ))}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs font-mono hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors shadow-xs"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Configuration
                </button>

                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 text-slate-700 font-medium text-xs font-mono hover:bg-slate-100 border border-slate-200 transition-colors shadow-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Defaults
                </button>
              </div>

              {message && (
                <div
                  className={`p-4 rounded-xl text-xs font-mono border shadow-xs ${
                    message.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sovereignty & Safety Notice */}
        <div className="p-5 rounded-2xl bg-white/90 border border-slate-200/80 flex items-start gap-3 text-xs font-sans text-slate-600 shadow-sm backdrop-blur-xl">
          <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            All configuration updates are strictly persisted to your local SQLite store. In accordance with non-destructive system sovereignty principles, SYSTEMOS does not include automated process termination or hostile kernel kill routines.
          </p>
        </div>
      </main>
    </div>
  );
}
