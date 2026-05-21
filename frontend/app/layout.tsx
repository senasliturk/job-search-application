import "./globals.css";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import ChatWidget from "@/components/ChatWidget";

export const metadata = {
  title: "kariyer.4458 — İş İlanları & Kariyer Fırsatları",
  description:
    "Binlerce iş ilanı tek yerde. Pozisyon, şehir ve çalışma tercihine göre ara, akıllı iş alarmı kur, AI asistanla başvuru yap.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Nav />
        <main className="max-w-6xl mx-auto px-4 py-8 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
        <footer className="border-t border-gray-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
            <span>
              © {new Date().getFullYear()} kariyer.4458 — SE 4458 Final Project
            </span>
            <span>Yaşar Üniversitesi · Software Architecture & Design</span>
          </div>
        </footer>
        <ChatWidget />
      </body>
    </html>
  );
}
