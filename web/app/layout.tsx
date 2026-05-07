import type { Metadata } from "next";
import { Barlow_Condensed, Barlow } from "next/font/google";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: "London Tennis Courts",
  description: "Get notified the moment your local court opens for booking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${barlowCondensed.variable} ${barlow.variable} font-sans bg-stone-50 text-gray-900 h-screen flex flex-col`}
      >
        <header className="bg-white border-b border-gray-100 shrink-0">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
            <a href="/" className="flex items-center gap-2.5">
              <span className="text-xl leading-none">🎾</span>
              <span className="font-display font-bold text-lg uppercase tracking-[0.15em] text-brand">
                London Tennis
              </span>
            </a>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
