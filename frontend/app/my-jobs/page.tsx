"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { admin } from "@/lib/api";
import type { Job } from "@/lib/api";
import { firebaseAuth, onAuthStateChanged, type User } from "@/lib/firebase";

const WP_LABEL: Record<string, string> = {
  onsite: "İş Yerinde",
  remote: "Uzaktan",
  hybrid: "Hibrit",
};

export default function MyJobsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) { setUser(null); return; }
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/login?next=/my-jobs"); return; }
      setUser(u);
      const tok = await u.getIdTokenResult(true);
      const role = tok.claims.role as string | undefined;
      if (role !== "company" && role !== "admin") {
        router.replace("/");
        return;
      }
      // Find company by displayName
      const companies = await admin.listCompanies().catch(() => []);
      const match = companies.find(
        (c: any) => c.name.toLowerCase() === (u.displayName ?? "").toLowerCase()
      );
      if (match) {
        setCompanyId(match.id);
        setCompanyName(match.name);
      } else if (u.displayName) {
        // Auto-create if not exists
        const created = await admin.createCompany(u.displayName).catch(() => null);
        if (created) { setCompanyId(created.id); setCompanyName(created.name); }
      }
    });
  }, [router]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    admin
      .listJobs(companyId)
      .then((page) => setJobs(page.items))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [companyId]);

  async function handleDelete(job: Job) {
    if (!confirm(`"${job.title}" ilanını kaldırmak istediğinize emin misiniz?`)) return;
    setDeletingId(job.id);
    try {
      await admin.deleteJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      setMsg({ kind: "success", text: `"${job.title}" kaldırıldı.` });
    } catch (e: any) {
      setMsg({ kind: "error", text: e.message ?? "Silinemedi." });
    } finally {
      setDeletingId(null);
    }
  }

  if (user === undefined) {
    return <div className="text-gray-500 text-sm">Yükleniyor…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {companyName ? (
              <>{companyName} <span className="text-brand">İlanları</span></>
            ) : (
              <>Verdiğim <span className="text-brand">İlanlar</span></>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Şirketinizin tüm aktif iş ilanları
          </p>
        </div>
        <Link
          href="/admin"
          className="btn-primary text-sm px-4 py-2.5 inline-flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Yeni İlan Ekle
        </Link>
      </div>

      {/* Message */}
      {msg && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            msg.kind === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/4"></div>
                </div>
                <div className="h-8 w-20 bg-gray-100 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-3">📋</div>
          <h3 className="font-semibold text-gray-900 text-lg">Henüz ilan yok</h3>
          <p className="text-sm text-gray-500 mt-1 mb-5">
            İlk ilanınızı yayınlayarak başlayın.
          </p>
          <Link href="/admin" className="btn-primary text-sm px-5 py-2.5 inline-flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Yeni İlan Ekle
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="card p-5 flex flex-wrap items-center gap-4">
              {/* Company avatar */}
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand to-fuchsia-500 text-white text-base font-bold flex items-center justify-center shrink-0">
                {job.company.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{job.title}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {job.city}{job.town ? ` · ${job.town}` : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                    {WP_LABEL[job.work_preference] ?? job.work_preference}
                  </span>
                  <span className="capitalize">{job.position_level}</span>
                  <span className="text-gray-400">
                    {new Date(job.last_updated).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2">
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">
                  {job.application_count} başvuru
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/jobs/${job.id}`}
                  target="_blank"
                  className="text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                >
                  Görüntüle
                </Link>
                <button
                  onClick={() => handleDelete(job)}
                  disabled={deletingId === job.id}
                  className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-300 hover:bg-red-50 transition disabled:opacity-50"
                >
                  {deletingId === job.id ? "…" : "Kaldır"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
