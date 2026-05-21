"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { admin } from "@/lib/api";
import { firebaseAuth, onAuthStateChanged, type User } from "@/lib/firebase";

const WP_OPTIONS = [
  { value: "onsite", label: "İş Yerinde", icon: "🏢" },
  { value: "remote", label: "Uzaktan", icon: "🌍" },
  { value: "hybrid", label: "Hibrit", icon: "🔀" },
] as const;

const LEVEL_OPTIONS = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "expert", label: "Uzman" },
] as const;

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [role, setRole] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    country: "Türkiye",
    city: "İzmir",
    town: "",
    work_preference: "onsite",
    position_level: "mid",
    department: "IT",
  });
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);

  // Auth gate: redirect to /login if Firebase configured and user not signed in.
  // In dev mode (no Firebase) we allow access so backend dev-fallback works.
  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      setUser(null);
      return;
    }
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/login?next=/admin");
      } else {
        setUser(u);
        try {
          const tok = await u.getIdTokenResult(true);
          setRole((tok.claims.role as string) ?? null);
        } catch {
          setRole(null);
        }
      }
    });
  }, [router]);

  useEffect(() => {
    admin
      .listCompanies()
      .then((list) => { setCompanies(list); setCompaniesLoaded(true); })
      .catch(() => { setCompanies([]); setCompaniesLoaded(true); });
  }, []);

  // Company kullanıcısı: eşleşen şirket varsa seç, yoksa otomatik oluştur
  useEffect(() => {
    if (!companiesLoaded || role !== "company" || !user?.displayName) return;
    const match = companies.find(
      (c) => c.name.toLowerCase() === user.displayName!.toLowerCase()
    );
    if (match) {
      setCompanyId(match.id);
    } else {
      admin
        .createCompany(user.displayName!)
        .then(async (c) => {
          setCompanyId(c.id);
          const list = await admin.listCompanies();
          setCompanies(list);
        })
        .catch(() => {});
    }
  }, [companiesLoaded, user, role]);

  if (user === undefined) {
    return <div className="text-gray-500">Yükleniyor…</div>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const j = await admin.createJob({ ...form, company_id: companyId });
      setMsg({ kind: "success", text: `“${j.title}” ilanı oluşturuldu.` });
      setForm({ ...form, title: "", description: "" });
    } catch (e: any) {
      setMsg({ kind: "error", text: e.message ?? "Bir hata oluştu." });
    } finally {
      setBusy(false);
    }
  }

  async function quickCreateCompany() {
    const name = prompt("Yeni şirket adı:");
    if (!name) return;
    try {
      const c = await admin.createCompany(name);
      const list = await admin.listCompanies();
      setCompanies(list);
      setCompanyId(c.id);
      setMsg({ kind: "success", text: `“${name}” şirketi eklendi.` });
    } catch (e: any) {
      setMsg({ kind: "error", text: e.message ?? "Şirket eklenemedi." });
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        {role !== "company" && (
          <div className="inline-flex items-center gap-1.5 bg-brand/10 text-brand-700 text-xs font-medium px-3 py-1.5 rounded-full mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Admin Paneli
          </div>
        )}
        <h1 className="text-3xl font-bold text-gray-900">İş İlanı Ekle</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Yayınladığın anda ilan tüm aramalarda görünür ve eşleşen iş
          alarmlarını bekleyenlere bildirim gider.
        </p>
      </div>

      {/* ── Form card ──────────────────────────────────────────── */}
      <form onSubmit={submit} className="card p-6 sm:p-8 space-y-6">
        {/* Section: Company */}
        <section>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Şirket
          </div>
          {role === "company" ? (
            <div className="input flex-1 bg-gray-50 text-gray-700 flex items-center gap-2 cursor-default">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-500 shrink-0"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              <span>{user?.displayName ?? "Şirketiniz"}</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                className="input flex-1"
              >
                <option value="">Şirket seç…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={quickCreateCompany}
                className="btn-secondary text-sm whitespace-nowrap"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Yeni Şirket
              </button>
            </div>
          )}
        </section>

        {/* Section: Job */}
        <section className="pt-6 border-t border-gray-100 space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            İlan Detayları
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Başlık
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="örn. Frontend Developer"
              className="input"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Açıklama
            </label>
            <textarea
              required
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Aranan yetkinlikler, sorumluluklar, sağlanan imkanlar…"
              className="input resize-y min-h-[120px]"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Ülke
              </label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Şehir
              </label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                İlçe <span className="text-gray-400">(opsiyonel)</span>
              </label>
              <input
                value={form.town}
                onChange={(e) => setForm({ ...form, town: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Departman
              </label>
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="input"
              />
            </div>
          </div>
        </section>

        {/* Section: Preferences */}
        <section className="pt-6 border-t border-gray-100 space-y-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Tercihler
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">
              Çalışma Tercihi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {WP_OPTIONS.map((o) => {
                const active = form.work_preference === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm({ ...form, work_preference: o.value })}
                    className={`text-sm py-3 rounded-xl border transition flex flex-col items-center gap-1 ${
                      active
                        ? "border-brand bg-brand/5 text-brand-700 font-medium"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-lg leading-none">{o.icon}</span>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">
              Pozisyon Seviyesi
            </label>
            <div className="grid grid-cols-4 gap-2">
              {LEVEL_OPTIONS.map((o) => {
                const active = form.position_level === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm({ ...form, position_level: o.value })}
                    className={`text-sm py-2 rounded-xl border transition ${
                      active
                        ? "border-brand bg-brand/5 text-brand-700 font-medium"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Message + submit */}
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

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="inline-block -mt-0.5 mr-1"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            Firebase token’ında <code className="font-mono">role=admin</code> veya{" "}
            <code className="font-mono">role=company</code> custom-claim gerekli.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary disabled:opacity-60"
          >
            {busy ? "Yayınlanıyor…" : "İlanı Yayınla"}
          </button>
        </div>
      </form>
    </div>
  );
}
