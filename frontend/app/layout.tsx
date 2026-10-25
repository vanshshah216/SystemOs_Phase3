import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "SYSTEMOS – Statistical Performance Monitor & Root-Cause Diagnosis",
  description: "Local system-monitoring and explainable root-cause diagnosis software.",
  icons: {
    icon: "/systemos-logo.png",
    shortcut: "/systemos-logo.png",
    apple: "/systemos-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <body className="bg-[#FAFCFF] text-[#172033] antialiased min-h-screen selection:bg-blue-100 selection:text-blue-900">
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
