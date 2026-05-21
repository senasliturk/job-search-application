"use client";
import Link from "next/link";
import type { Job } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";

// Deterministic color from a string — so each company gets a stable avatar bg.
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

const WORK_PREF_TR: Record<string, string> = {
  onsite: "İş Yerinde",
  remote: "Uzaktan",
  hybrid: "Hibrit",
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const mins = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} saat önce`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} gün önce`;
  return d.toLocaleDateString("tr-TR");
}

export default function JobCard({ job, compact = false }: { job: Job; compact?: boolean }) {
  const isLoggedIn = Boolean(firebaseAuth()?.currentUser);

  const initials = (job.company?.name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const isRecent =
    Date.now() - new Date(job.last_updated).getTime() < 1000 * 60 * 60 * 24;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block card p-4 sm:p-5 hover:shadow-glow hover:-translate-y-0.5 hover:border-brand/30 transition-all"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Avatar */}
        <div
          className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${colorFor(
            job.company?.name ?? "?",
          )} text-white font-semibold flex items-center justify-center shadow-sm`}
        >
          {initials || "?"}
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand transition">
                {job.title}
              </h3>
              <div className="text-sm text-gray-600 truncate">
                {job.company?.name}
              </div>
            </div>
            {isRecent && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Yeni
              </span>
            )}
          </div>

          {/* Meta line */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s-7-7.5-7-13a7 7 0 1 1 14 0c0 5.5-7 13-7 13z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {job.city}
              {job.town ? ` · ${job.town}` : ""}
            </span>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              {WORK_PREF_TR[job.work_preference] ?? job.work_preference}
            </span>
            <span className="text-gray-300">·</span>
            <span>{timeAgo(job.last_updated)}</span>
          </div>

          {/* Tags */}
          {!compact && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-xs bg-brand/10 text-brand-700 px-2.5 py-1 rounded-full font-medium">
                {job.position_level}
              </span>
              {(job as any).department && (
                <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                  {(job as any).department}
                </span>
              )}
              {isLoggedIn && typeof job.application_count === "number" && job.application_count > 0 && (
                <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
                  {job.application_count} başvuru
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
