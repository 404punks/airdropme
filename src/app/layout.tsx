import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { SiteShell } from "@/components/site-shell";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne" });

export const metadata: Metadata = {
  title: "AirdropMe · Pump.fun community stats",
  description: "Track public Pump.fun statistics, campaign points, and airdrop claim registration.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${syne.variable} font-sans antialiased`}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
