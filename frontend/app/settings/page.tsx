"use client";
import { useState, useEffect } from "react";
import TopBar from "@/components/layout/TopBar";
import { api } from "@/lib/api";
import { useHealth } from "@/hooks/useMetrics";
import type { AppSettings } from "@/types";
import { Loader2, Save, RotateCcw, Radio, Database, Server, Shield, CheckCircle2 } from "lucide-react";
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

  const health = useHealth();

  useEffect(() => {
    api.getSettings()
      .then(s => { setSettings(s); setDirty(false); })
      .catch(() => {})
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
      setMessage({ type: "success", text: "Settings saved successfully. Changes will take effect on the next collection cycle." });
    } catch (e: any) {
      setMessage({ type: "error", text: `Error updating settings: ${e.message}` });
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
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b0f17]">
      <TopBar title="Settings" subtitle="System Configuration" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 font-sans">
            SYSTEM SETTINGS
          </h2>
          <p className="text-sm text-slate-400 font-sans mt-1">
            Configure telemetry sampling frequencies, rolling baseline windows, and anomaly thresholds.
          </p>
        </div>

        {/* System Service Health Status Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 text-sky-400 border border-slate-700">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-sans">Collector Daemon</div>
                <div className="text-sm font-bold font-mono text-slate-200 mt-0.5">
                  {health?.collector_running ? "Running" : "Stopped"}
                </div>
              </div>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${health?.collector_running ? "bg-emerald-500" : "bg-rose-500"}`} />
          </div>

          <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 border border-slate-700">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-sans">SQLite Database</div>
                <div className="text-sm font-bold font-mono text-slate-200 mt-0.5">
                  {health?.database_ok ? "Connected" : "Error"}
                </div>
              </div>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${health?.database_ok ? "bg-emerald-500" : "bg-rose-500"}`} />
          </div>

          <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-sans">REST API Service</div>
                <div className="text-sm font-bold font-mono text-slate-200 mt-0.5">
                  Healthy
                </div>
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* Configuration Sliders & Fields */}
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="pb-4 border-b border-[#1e293b]">
            <h3 className="text-lg font-bold text-slate-100 font-sans">
              Mathematical Parameters
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              These values govern the rolling statistical baseline, Z-score anomaly detector, and persistence state machines.
            </p>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center text-xs font-mono text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400 mr-2" /> Loading parameter set...
            </div>
          ) : (
            <div className="space-y-6">
              {FIELDS.map(f => (
                <div key={f.key} className="p-5 rounded-lg bg-[#0d1322] border border-[#1a243a] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <label className="text-sm font-semibold text-slate-200 font-sans flex items-center">
                        {f.label}
                        {f.tooltipTerm && <Tooltip term={f.tooltipTerm} explanation="" />}
                      </label>
                      <p className="text-xs text-slate-400 font-sans mt-0.5">{f.desc}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-bold font-mono text-sky-400">
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
                    className="w-full h-2 rounded-lg bg-slate-800 appearance-none cursor-pointer accent-sky-500"
                  />

                  <div className="flex justify-between text-[11px] font-mono text-slate-500">
                    <span>Min: {f.min} {f.unit}</span>
                    <span>Max: {f.max} {f.unit}</span>
                  </div>
                </div>
              ))}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#1e293b] flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs font-mono hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Configuration
                </button>

                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-medium text-xs font-mono hover:bg-slate-700 border border-slate-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Defaults
                </button>
              </div>

              {message && (
                <div
                  className={`p-4 rounded-lg text-xs font-mono border ${
                    message.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sovereignty & Safety Notice */}
        <div className="p-5 rounded-xl bg-[#111726] border border-[#1e293b] flex items-start gap-3 text-xs font-sans text-slate-400">
          <Shield className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            All configuration updates are strictly persisted to your local SQLite store. In accordance with non-destructive system sovereignty principles, SYSTEMOS does not include automated process termination or hostile kernel kill routines.
          </p>
        </div>
      </main>
    </div>
  );
}
