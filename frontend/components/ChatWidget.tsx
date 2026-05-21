"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { agent, jobs } from "@/lib/api";
import { firebaseAuth, onAuthStateChanged } from "@/lib/firebase";

type Msg = { role: "user" | "assistant"; content: string; jobs?: any[] };

const WELCOME: Msg = {
  role: "assistant",
  content: "Merhaba! 👋 Sana nasıl yardımcı olabilirim? Pozisyon, şehir veya çalışma tercihi yazabilirsin.",
};

const QUICK_PROMPTS = [
  "İzmir'de Frontend Developer",
  "Uzaktan yazılım işleri",
  "İstanbul'da Backend",
];

/** Renders **bold** markers in text as <strong> elements. */
function MdText({ text }: { text: string }) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {segments.map((seg, i) =>
        seg.startsWith("**") && seg.endsWith("**") ? (
          <strong key={i}>{seg.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{seg}</span>
        ),
      )}
    </>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [applyState, setApplyState] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});
  const endRef = useRef<HTMLDivElement>(null);
  const prevUidRef = useRef<string | null | undefined>(undefined);

  // Reset conversation on logout
  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      const uid = u?.uid ?? null;
      // prevUidRef.current === undefined means "first load, don't reset"
      if (prevUidRef.current !== undefined && prevUidRef.current !== null && uid === null) {
        setMessages([WELCOME]);
        setOpen(false);
      }
      prevUidRef.current = uid;
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function handleApply(jobId: string) {
    setApplyState((s) => ({ ...s, [jobId]: "loading" }));
    try {
      await jobs.apply(jobId);
      setApplyState((s) => ({ ...s, [jobId]: "done" }));
    } catch (e: any) {
      const isLogin = e?.message?.includes("401") || e?.message?.includes("403");
      if (isLogin) {
        setApplyState((s) => ({ ...s, [jobId]: "error" }));
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "🔒 Başvurmak için önce giriş yapman gerekiyor." },
        ]);
      } else {
        setApplyState((s) => ({ ...s, [jobId]: "error" }));
      }
    }
  }

  async function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await agent.chat(
        next.map(({ role, content }) => ({ role, content })),
      );
      setMessages([
        ...next,
        { role: "assistant", content: res.reply, jobs: res.jobs },
      ]);
    } catch (e: any) {
      setMessages([
        ...next,
        { role: "assistant", content: "Hata: " + e.message },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // ── Closed state: floating button ─────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 bg-gradient-to-r from-brand to-fuchsia-500 text-white rounded-full pl-3 pr-5 py-3 shadow-glow hover:scale-105 active:scale-95 transition"
        aria-label="AI asistanı aç"
      >
        <span className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M12 2l1.5 3L17 6l-2.5 2.5L15 12l-3-1.5L9 12l.5-3.5L7 6l3.5-1z" />
            <path d="M5 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
          </svg>
        </span>
        <span className="font-medium">Staff Agent</span>
        <span className="hidden group-hover:inline text-xs opacity-90">
          · Aç
        </span>
      </button>
    );
  }

  // ── Open state: chat panel ────────────────────────────────────
  return (
    <div className="fixed bottom-5 right-5 z-50 w-[92vw] sm:w-[400px] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand to-fuchsia-500 rounded-t-2xl">
        <div className="flex items-center gap-2.5 text-white">
          <div className="relative w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2l1.5 3L17 6l-2.5 2.5L15 12l-3-1.5L9 12l.5-3.5L7 6l3.5-1z" />
            </svg>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white"></span>
          </div>
          <div className="leading-tight">
            <div className="font-semibold">Staff Agent</div>
            <div className="text-xs text-white/80">Çevrimiçi · ortalama yanıt &lt; 1sn</div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition"
          aria-label="Kapat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm bg-gradient-to-b from-gray-50 to-white">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] ${
                m.role === "user"
                  ? "bg-brand text-white rounded-2xl rounded-br-md px-3.5 py-2.5"
                  : "bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">
                <MdText text={m.content} />
              </p>
              {m.jobs && m.jobs.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {m.jobs.map((j: any) => (
                    <li
                      key={j.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs flex justify-between items-center gap-2 text-gray-800"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{j.title}</div>
                        <div className="text-gray-500 truncate">
                          {j.company} · {j.city}
                        </div>
                      </div>
                      <div className="shrink-0 flex gap-1.5">
                        <Link
                          href={`/jobs/${j.id}`}
                          onClick={() => setOpen(false)}
                          className="bg-brand hover:bg-brand-dark text-white font-medium px-2.5 py-1 rounded-md transition text-xs"
                        >
                          Aç →
                        </Link>
                        <button
                          onClick={() => handleApply(j.id)}
                          disabled={applyState[j.id] === "loading" || applyState[j.id] === "done"}
                          className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-medium px-2.5 py-1 rounded-md transition text-xs"
                        >
                          {applyState[j.id] === "done"
                            ? "✓ Başvuruldu"
                            : applyState[j.id] === "loading"
                            ? "…"
                            : applyState[j.id] === "error"
                            ? "Hata!"
                            : "Başvur"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick prompts (only when conversation hasn't really started) */}
      {messages.length <= 1 && !busy && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="text-xs bg-brand/10 hover:bg-brand/20 text-brand-700 px-2.5 py-1 rounded-full transition"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-100 bg-white rounded-b-2xl flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Mesaj yaz…"
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition"
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          className="w-10 h-10 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition"
          aria-label="Gönder"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
