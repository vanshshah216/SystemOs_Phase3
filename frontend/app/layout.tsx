import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "SYSTEMOS – Statistical Performance Monitor & Root-Cause Diagnosis",
  description: "Local system-monitoring and explainable root-cause diagnosis software.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0d1117] text-slate-100 antialiased min-h-screen">
        <div className="flex min-h-screen relative z-10">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
