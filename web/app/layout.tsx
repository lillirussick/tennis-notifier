import type { Metadata } from "next";
import { Barlow_Condensed, Barlow } from "next/font/google";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
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
  title: "Find Your London Tennis Court",
  description: "Get notified the moment your local court opens for booking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${barlowCondensed.variable} ${barlow.variable} font-sans bg-stone-50 text-gray-900 h-screen flex flex-col`}
      >
        <header className="bg-brand-dark shrink-0">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <a href="/">
              <span className="font-display font-black text-2xl uppercase tracking-[0.1em] text-white">
                Find Your London Tennis Court
              </span>
            </a>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
