import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { TopNav } from "@/components/layout/TopNav";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RMMob — RMUC Analytics",
  description: "RoboMaster match analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={manrope.variable}>
      <body>
        <div className="app-shell">
          <TopNav />
          <main className="container page">{children}</main>
        </div>
      </body>
    </html>
  );
}
