"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import JobCard from "@/components/JobCard";
import { jobs } from "@/lib/api";
import type { Job } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";

const WP_LABEL: Record<string, string> = {
  onsite: "İş Yerinde",
  remote: "Uzaktan",
  hybrid: "Hibrit",
};

function colorFor(name: string): string {
  const palette = [
    "from-purple-500 to-fuchsia-500",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-orange-500 to-rose-500",
    "from-indigo-500 to-purple-500",
    "from-pink-500 to-rose-500",
    "from-amber-500 to-orange-500",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [related, setRelated] = useState<Job[]>([]);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    jobs.byId(id).then(setJob).catch(() => router.push("/"));
    jobs.related(id).then(setRelated).catch(() => setRelated([]));
  }, [id, router]);

  // Check if already applied once the job and user are both ready
  useEffect(() => {
    if (!job) return;
    const u = firebaseAuth()?.currentUser;
    if (!u) return;
    jobs.myApplication(id)
      .then(() => setApplied(true))
      .catch(() => {}); // 404 → not applied, ignore
  }, [id, job]);

  async function apply() {
    const u = firebaseAuth()?.currentUser;
    if (!u) {
      router.push(`/login?next=/jobs/${id}`);
      return;
    }
    try {
      await jobs.apply(id);
      setApplied(true);
      setMsg({ kind: "success", text: "Başvurunuz alındı! 🎉" });
    } catch (e: any) {
      if (e?.message?.includes("409")) {
        setApplied(true);
        setMsg({ kind: "success", text: "Bu ilana zaten başvurdunuz." });
      } else {
        setMsg({ kind: "error", text: "Hata: " + e.message });
      }
    }
  }

  if (!job) {
    return (
      <div className="card p-12 text-center text-gray-500 animate-pulse">
        Yükleniyor…
      </div>
    );
  }

  const initials = (job.company?.name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 flex items-center gap-1.5">
        <Link href="/" className="hover:text-brand">Anasayfa</Link>
        <span>›</span>
        <Link href="/search" className="hover:text-brand">İlanlar</Link>
        <span>›</span>
        <span className="text-gray-700 truncate max-w-[40ch]">{job.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ── Main ───────────────────────────────────────────────── */}
        <article className="card p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div
              className={`shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${colorFor(
                job.company?.name ?? "?",
              )} text-white text-xl font-bold flex items-center justify-center shadow-sm`}
            >
              {initials || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                {job.title}
              </h1>
              <div className="text-gray-600 mt-0.5">{job.company.name}</div>
              <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s-7-7.5-7-13a7 7 0 1 1 14 0c0 5.5-7 13-7 13z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                {job.city}
                {job.town ? `, ${job.town}` : ""} · {WP_LABEL[job.work_preference]}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={apply}
              disabled={applied}
              className={`btn-primary ${applied ? "opacity-70 cursor-default" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" />
              </svg>
              {applied ? "Başvuruldu ✓" : "Başvur"}
            </button>
            <button
              onClick={() => setSaved(!saved)}
              className={`btn-secondary ${saved ? "border-brand text-brand" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              {saved ? "Kaydedildi" : "Kaydet"}
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                setMsg({ kind: "success", text: "Bağlantı kopyalandı." });
              }}
              className="btn-secondary"
              aria-label="Paylaş"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
              </svg>
              Paylaş
            </button>
          </div>

          {msg && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                msg.kind === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* Quick facts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 sm:my-8">
            <Field label="Çalışma Şekli" value={WP_LABEL[job.work_preference]} />
            <Field
              label="Pozisyon Seviyesi"
              value={job.position_level[0].toUpperCase() + job.position_level.slice(1)}
            />
            <Field label="Departman" value={(job as any).department || "-"} />
            <Field
              label="Başvuru Sayısı"
              value={`${job.application_count} başvuru`}
            />
          </div>

          {/* Description */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              İlan Açıklaması
            </h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {job.description}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500">
            Son güncelleme: {new Date(job.last_updated).toLocaleString("tr-TR")}
          </div>
        </article>

        {/* ── Sidebar ────────────────────────────────────────────── */}
        <aside className="space-y-3">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 px-1">
              İlgini Çekebilecek İlanlar
            </h3>
            <div className="space-y-3">
              {related.map((j) => (
                <JobCard key={j.id} job={j} compact />
              ))}
              {related.length === 0 && (
                <div className="card p-6 text-center text-sm text-gray-500">
                  İlgili ilan yok.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900 text-sm mt-0.5 truncate">
        {value}
      </div>
    </div>
  );
}
