import "./globals.css";
import type { Metadata } from "next";
import { Terminal } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "wijo IMAN MEHNI",
  description: "iman mehni",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col text-sm md:text-base">
        <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-3 text-neutral-300 hover:text-white transition-colors"
            >
              <Terminal className="w-5 h-5 text-cyan-500" />
              <span className="font-bold tracking-widest uppercase">WIJO IMAN MEHNI</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse"></div>
              <span className="text-green-500 text-xs font-semibold tracking-wider uppercase">
                SYSTEM ONLINE
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
