import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "London Tennis Courts",
  description: "Get notified the moment your local court opens for booking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
            <span className="text-2xl">🎾</span>
            <span className="font-semibold text-gray-900">London Tennis Courts</span>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
