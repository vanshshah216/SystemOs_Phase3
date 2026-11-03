const knownProcessNames: Record<string, string> = {
  "chrome.exe": "Google Chrome",
  "msedge.exe": "Microsoft Edge",
  "firefox.exe": "Mozilla Firefox",
  "brave.exe": "Brave",
  "opera.exe": "Opera",
  "mspaint.exe": "Microsoft Paint",
  "snippingtool.exe": "Snipping Tool",
  "winstore.app.exe": "Microsoft Store",
  "code.exe": "Visual Studio Code",
  "python.exe": "Python",
  "pythonw.exe": "Python",
  "node.exe": "Node.js Runtime",
  "svchost.exe": "Service Host",
  "services.exe": "Windows Services Controller",
  "dllhost.exe": "COM Surrogate",
  "lsass.exe": "Local Security Authority Process",
  "wininit.exe": "Windows Start-Up Application",
  "csrss.exe": "Client Server Runtime Process",
  "smss.exe": "Windows Session Manager",
  "winlogon.exe": "Windows Logon Application",
  "dwm.exe": "Desktop Window Manager",
  "spoolsv.exe": "Print Spooler",
  "widgetservice.exe": "Windows Widgets",
};

const executablePattern = /\b[\w.-]+\.exe\b/i;
const executableNamesPattern = /\b[\w.-]+\.exe\b/gi;
const unidentifiedLabels = new Set([
  "unidentified application",
  "unknown",
  "inaccessible process",
]);

export function getProcessDisplayName(
  displayName?: string | null,
  processName?: string | null,
): string {
  const displayIsUnidentified = !displayName ||
    unidentifiedLabels.has(displayName.trim().toLowerCase());
  if (!displayIsUnidentified && !executablePattern.test(displayName)) return displayName;

  const name = processName || displayName || "";
  const normalizedName = name.trim().replace(/\.exe$/i, "");
  if (!normalizedName || unidentifiedLabels.has(normalizedName.toLowerCase())) {
    return "Background task";
  }
  return knownProcessNames[name.toLowerCase()] || normalizedName;
}

export function hideExecutableNames(text: string): string {
  return text
    .replace(executableNamesPattern, (name) => getProcessDisplayName(null, name))
    .replace(/\bunidentified application\b/gi, "background task");
}
