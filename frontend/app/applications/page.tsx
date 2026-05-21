"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { admin, userProfile } from "@/lib/api";
import { firebaseAuth, onAuthStateChanged, type User } from "@/lib/firebase";

type Application = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  applied_at: string;
  status: string;
  job_id: string;
  job_title: string;
  school: string | null;
  department: string | null;
  cv_filename: string | null;
  education_status: string | null;
  class_year: string | null;
  experience_level: string | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Başvurdu", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  reviewing: { label: "İnceleniyor", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  accepted: { label: "Kabul Edildi", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Reddedildi", cls: "bg-red-50 text-red-700 border-red-200" },
};

export default function ApplicationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function refreshApps() { setRefreshKey((k: number) => k + 1); }

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) { setUser(null); return; }
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/login?next=/applications"); return; }
      setUser(u);
      const tok = await u.getIdTokenResult(true);
      const role = tok.claims.role as string | undefined;
      if (role !== "company" && role !== "admin") { router.replace("/"); return; }

      const companies = await admin.listCompanies().catch(() => []);
      const match = companies.find(
        (c: any) => c.name.toLowerCase() === (u.displayName ?? "").toLowerCase()
      );
      if (match) { setCompanyId(match.id); setCompanyName(match.name); }
    });
  }, [router]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    admin
      .listApplications(companyId)
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [companyId, refreshKey]);

  if (user === undefined) return <div className="text-gray-500 text-sm">Yükleniyor…</div>;

  // Group by job
  const byJob = apps.reduce<Record<string, { title: string; items: Application[] }>>((acc, a) => {
    if (!acc[a.job_id]) acc[a.job_id] = { title: a.job_title, items: [] };
    acc[a.job_id].items.push(a);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {companyName ? (
              <>{companyName} <span className="text-brand">Başvuruları</span></>
            ) : (
              <>İş <span className="text-brand">Başvuruları</span></>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tüm ilanlarınıza gelen başvurular
          </p>
        </div>
        <Link href="/my-jobs" className="btn-secondary text-sm px-4 py-2.5 inline-flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          İlanlarım
        </Link>
        <button
          onClick={refreshApps}
          disabled={loading}
          className="btn-secondary text-sm px-4 py-2.5 inline-flex items-center gap-2 disabled:opacity-50"
          title="Başvuruları yenile"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? "animate-spin" : ""}>
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Yenile
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-3 bg-gray-100 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-3">📭</div>
          <h3 className="font-semibold text-gray-900 text-lg">Henüz başvuru yok</h3>
          <p className="text-sm text-gray-500 mt-1">
            İlanlarınıza başvuru yapıldığında burada görünür.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byJob).map(([jobId, group]) => (
            <div key={jobId} className="card p-0 overflow-hidden">
              {/* Job header */}
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{group.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{group.items.length} başvuru</p>
                </div>
                <Link
                  href={`/jobs/${jobId}`}
                  target="_blank"
                  className="text-xs text-brand hover:text-brand-dark font-medium inline-flex items-center gap-1"
                >
                  İlanı Gör
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </Link>
              </div>

              {/* Applicant rows */}
              <div className="divide-y divide-gray-100">
                {group.items.map((app) => {
                  const st = STATUS_LABEL[app.status] ?? { label: app.status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
                  const name = app.display_name || app.email || `Kullanıcı #${app.user_id.slice(0, 8)}`;
                  const initials = name.slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={app.id}
                      onClick={() => setSelected(app)}
                      className="px-5 py-3.5 flex flex-wrap items-center gap-3 cursor-pointer hover:bg-gray-50 transition"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand/60 to-fuchsia-400/60 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(app.applied_at).toLocaleDateString("tr-TR", {
                            day: "numeric", month: "long", year: "numeric",
                          })}
                        </p>
                      </div>
                      {/* Status */}
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${st.cls}`}>
                        {st.label}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Applicant Profile Slide-out ──────────────────────────── */}
      {selected && (() => {
        const st = STATUS_LABEL[selected.status] ?? { label: selected.status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
        const name = selected.display_name || selected.email || `Kullanıcı #${selected.user_id.slice(0, 8)}`;
        const initials = name.slice(0, 2).toUpperCase();
        return (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
              onClick={() => setSelected(null)}
            />
            {/* Panel */}
            <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-up">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Başvuran Profili</h2>
                <button
                  onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 6l12 12M6 18L18 6"/>
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Avatar + Name */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand/70 to-fuchsia-400/70 text-white text-xl font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{name}</p>
                    {selected.email && selected.display_name && (
                      <p className="text-sm text-gray-500">{selected.email}</p>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <InfoRow label="Ad Soyad" value={selected.display_name ?? "—"} />
                  <InfoRow label="E-posta" value={selected.email ?? "—"} />
                  {selected.school && <InfoRow label="Okul" value={selected.school} />}
                  {selected.department && <InfoRow label="Bölüm" value={selected.department} />}
                  {(selected.education_status || selected.experience_level) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selected.education_status && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {{
                            student: "🎓 Öğrenciyim",
                            graduate: "✅ Mezun",
                            no_degree: "🔧 Üniversite Okumadım",
                          }[selected.education_status] ?? selected.education_status}
                        </span>
                      )}
                      {selected.education_status === "student" && selected.class_year && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {{
                            prep:   "🎯 Hazırlık",
                            year_1: "1. Sınıf",
                            year_2: "2. Sınıf",
                            year_3: "3. Sınıf",
                            year_4: "4. Sınıf",
                            year_5: "5. Sınıf",
                          }[selected.class_year] ?? selected.class_year}
                        </span>
                      )}
                      {selected.experience_level && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200">
                          {{
                            new_grad: " New Grad",
                            junior: " Junior",
                            mid: " Mid",
                            senior: " Senior",
                          }[selected.experience_level] ?? selected.experience_level}
                        </span>
                      )}
                    </div>
                  )}
                  <InfoRow label="Kullanıcı ID" value={selected.user_id} mono />
                  <InfoRow
                    label="Başvuru Tarihi"
                    value={new Date(selected.applied_at).toLocaleString("tr-TR", {
                      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  />
                  <InfoRow label="Başvurduğu İlan" value={selected.job_title} />
                </div>

                {/* Status */}
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">DURUM</p>
                  <span className={`inline-flex text-sm font-medium px-3 py-1.5 rounded-full border ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 space-y-2">
                {selected.cv_filename && (
                  <button
                    onClick={async () => {
                      const displayName = selected.cv_filename!.includes("_")
                        ? selected.cv_filename!.split("_").slice(1).join("_")
                        : selected.cv_filename!;
                      setCvBusy(true);
                      try { await userProfile.downloadCv(selected.user_id, displayName); }
                      catch { alert("CV indirilemedi."); }
                      finally { setCvBusy(false); }
                    }}
                    disabled={cvBusy}
                    className="w-full btn-primary text-sm justify-center inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17,8 12,13 7,8"/>
                      <line x1="12" y1="13" x2="12" y2="3"/>
                    </svg>
                    {cvBusy ? "İndiriliyor…" : "CV İndir"}
                  </button>
                )}
                <Link
                  href={`/jobs/${selected.job_id}`}
                  target="_blank"
                  className="w-full btn-secondary text-sm justify-center inline-flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                  İlanı Görüntüle
                </Link>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className={`text-sm text-gray-800 break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
