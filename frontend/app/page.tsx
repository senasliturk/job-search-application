"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Autocomplete from "@/components/Autocomplete";
import JobCard from "@/components/JobCard";
import { jobs, search } from "@/lib/api";
import type { Job } from "@/lib/api";
import {
  firebaseAuth,
  onAuthStateChanged,
  type User,
} from "@/lib/firebase";

const POPULAR_TAGS = [
  "Yazılım Uzmanı",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Web Developer",
];

export default function Home() {
  const router = useRouter();
  const [position, setPosition] = useState("");
  const [city, setCity] = useState("");
  const [featured, setFeatured] = useState<Job[]>([]);
  const [recent, setRecent] = useState<
    { id: string; query_position?: string; query_city?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = not yet resolved
  const [role, setRole] = useState<string | null>(null);

  // Firebase auth listener
  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      setUser(null);
      return;
    }
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult(true);
        setRole((token.claims.role as string) ?? null);
      } else {
        setRole(null);
      }
    });
  }, []);

  useEffect(() => {
    let detectedCity = localStorage.getItem("user_city") || "";
    if (!detectedCity && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async () => {
          detectedCity = "İzmir";
          localStorage.setItem("user_city", detectedCity);
          setCity(detectedCity);
          load(detectedCity);
        },
        () => load(detectedCity),
      );
    } else {
      setCity(detectedCity);
      load(detectedCity);
    }
  }, []);

  async function load(c: string) {
    setLoading(true);
    try {
      setFeatured(await jobs.featured(c || undefined));
    } catch {
      setFeatured([]);
    }
    try {
      setRecent(await search.recent());
    } catch {
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }

  function go(presetPosition?: string) {
    const params = new URLSearchParams();
    const p = presetPosition ?? position;
    if (p) params.set("position", p);
    if (city) params.set("city", city);
    router.push(`/search?${params}`);
  }

  return (
    <div className="space-y-12">
      {/* ── Hero — adapts to auth state ──────────────────────────── */}
      {user && (role === "company" || role === "admin") ? (
        /* ── İşveren: employer dashboard ── */
        <section className="relative overflow-hidden card p-8 sm:p-10 animate-fade-in">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-fuchsia-300/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-brand/10 text-brand-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
              İşveren Paneli
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div>
                <p className="text-sm text-gray-500 mb-1">Hoş geldiniz 👋</p>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                  {user.displayName
                    ? <>{user.displayName}<span className="text-brand"> İK Paneli</span></>
                    : <span>İşveren <span className="text-brand">Paneli</span></span>}
                </h1>
                <p className="mt-1 text-gray-500 text-sm">{user.email}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href="/my-jobs" className="btn-secondary text-sm px-4 py-2 inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                  Verdiğim İlanlar
                </Link>
                <Link href="/admin" className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  İlan Yayınla
                </Link>
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Link href="/admin" className="group flex flex-col gap-3 bg-white rounded-2xl border border-gray-200/70 shadow-soft p-6 hover:border-brand/40 hover:shadow-md transition">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-600"><path d="M12 5v14M5 12h14"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">İlan Oluştur</p>
                  <p className="text-sm text-gray-500 mt-0.5">Yeni iş ilanı yayınla</p>
                </div>
              </Link>

              <Link href="/my-jobs" className="group flex flex-col gap-3 bg-white rounded-2xl border border-gray-200/70 shadow-soft p-6 hover:border-brand/40 hover:shadow-md transition">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">İlanlarımı Yönet</p>
                  <p className="text-sm text-gray-500 mt-0.5">Mevcut ilanları düzenle</p>
                </div>
              </Link>

              <Link href="/applications" className="group flex flex-col gap-3 bg-white rounded-2xl border border-gray-200/70 shadow-soft p-6 hover:border-brand/40 hover:shadow-md transition">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Başvurular</p>
                  <p className="text-sm text-gray-500 mt-0.5">Gelen başvuruları gör</p>
                </div>
              </Link>
            </div>

            {/* CTA to admin panel */}
            <div className="mt-6 flex justify-end">
              <Link href="/admin" className="btn-primary text-sm px-5 py-2.5 inline-flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Yönetim Paneline Git
              </Link>
            </div>
          </div>
        </section>
      ) : user ? (
        /* ── Logged-in candidate: personalised dashboard header ── */
        <section className="relative overflow-hidden card p-8 sm:p-10 animate-fade-in">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-fuchsia-300/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative">
            {/* Greeting */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Tekrar hoş geldin 👋</p>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                  {user.displayName
                    ? <>{user.displayName.split(" ")[0]}<span className="text-brand">,</span></>
                    : <span className="text-brand">Merhaba!</span>}
                </h1>
                <p className="mt-1 text-gray-500 text-sm">{user.email}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href="/alerts" className="btn-secondary text-sm px-4 py-2 inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  İş Alarmım
                </Link>
                <button onClick={() => router.push("/search")} className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                  İlan Ara
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="bg-white rounded-2xl shadow-soft border border-gray-200/70 p-2 sm:p-3">
              <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                <Autocomplete
                  placeholder="Pozisyon ara (örn. Yazılım Uzmanı)"
                  value={position}
                  onChange={setPosition}
                  fetcher={(q) => jobs.autocompletePositions(q)}
                />
                <Autocomplete
                  placeholder="Şehir veya ilçe ara"
                  value={city}
                  onChange={setCity}
                  fetcher={(q) => jobs.autocompleteCities(q)}
                />
                <button onClick={() => go()} className="btn-primary px-8">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  İŞ BUL
                </button>
              </div>
            </div>

            {/* Recent searches — prominent for logged-in users */}
            {recent.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
                  </svg>
                  Son Aramalarım
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => {
                    const text =
                      [r.query_city, r.query_position].filter(Boolean).join(" · ") ||
                      "(filtre yok)";
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          if (r.query_position) setPosition(r.query_position);
                          if (r.query_city) setCity(r.query_city);
                          const p = new URLSearchParams();
                          if (r.query_position) p.set("position", r.query_position);
                          if (r.query_city) p.set("city", r.query_city);
                          router.push(`/search?${p}`);
                        }}
                        className="text-xs bg-brand/8 hover:bg-brand/15 text-brand-700 rounded-full px-3 py-1.5 border border-brand/20 hover:border-brand/40 transition"
                      >
                        🔍 {text}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        /* ── Anonymous: promotional hero ── */
        <section className="relative overflow-hidden card p-8 sm:p-12 animate-fade-in">
          {/* Decorative blobs */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-fuchsia-300/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-brand/10 text-brand-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
              Türkiye'nin her yerinden binlerce ilan
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
              Kariyerinde bir sonraki{" "}
              <span className="bg-gradient-to-r from-brand to-fuchsia-500 bg-clip-text text-transparent">
                büyük adımı
              </span>{" "}
              at.
            </h1>
            <p className="mt-4 text-gray-600 text-lg max-w-2xl">
              Pozisyona, şehre ve çalışma tercihine göre arama yap. Akıllı iş
              alarmı kur, AI asistanla saniyeler içinde başvur.
            </p>

            {/* Search card */}
            <div className="mt-8 bg-white rounded-2xl shadow-soft border border-gray-200/70 p-2 sm:p-3">
              <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                <Autocomplete
                  placeholder="Pozisyon ara (örn. Yazılım Uzmanı)"
                  value={position}
                  onChange={setPosition}
                  fetcher={(q) => jobs.autocompletePositions(q)}
                />
                <Autocomplete
                  placeholder="Şehir veya ilçe ara"
                  value={city}
                  onChange={setCity}
                  fetcher={(q) => jobs.autocompleteCities(q)}
                />
                <button onClick={() => go()} className="btn-primary px-8">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  İŞ BUL
                </button>
              </div>
            </div>

            {/* Popular */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-500">Popüler:</span>
              {POPULAR_TAGS.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setPosition(t);
                    go(t);
                  }}
                  className="px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:border-brand hover:text-brand text-gray-700 text-xs transition"
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Son Aramalarım */}
            {recent.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  Son Aramalarım
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => {
                    const text =
                      [r.query_city, r.query_position].filter(Boolean).join(" · ") ||
                      "(filtre yok)";
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          if (r.query_position) setPosition(r.query_position);
                          if (r.query_city) setCity(r.query_city);
                          const p = new URLSearchParams();
                          if (r.query_position) p.set("position", r.query_position);
                          if (r.query_city) p.set("city", r.query_city);
                          router.push(`/search?${p}`);
                        }}
                        className="text-xs bg-white rounded-full px-3 py-1.5 border border-gray-200 hover:border-brand hover:text-brand transition"
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Featured — işverenler için gizle ─────────────────────── */}
      {!(user && (role === "company" || role === "admin")) && <section className="animate-slide-up">
        <div className="flex items-end justify-between mb-4 gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Öne Çıkan İlanlar</h2>
            {city && (
              <p className="text-sm text-gray-500 mt-0.5">
                Senin için <span className="font-medium text-gray-700">{city}</span>{" "}
                konumundaki güncel fırsatlar
              </p>
            )}
          </div>
          <button
            onClick={() => router.push("/search")}
            className="text-sm text-brand hover:text-brand-dark font-medium hidden sm:inline-flex items-center gap-1"
          >
            Tümünü gör
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-200"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-100 rounded w-2/3 mt-3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-2">🔍</div>
            <h3 className="font-semibold text-gray-900">Henüz ilan yok</h3>
            <p className="text-sm text-gray-500 mt-1">
              Admin panelinden ilan ekleyince burada görünür.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featured.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </section>}

      {/* ── How it works — only for anonymous visitors ────────────── */}
      {!user && (
        <section className="grid sm:grid-cols-3 gap-3 animate-slide-up">
        {[
          {
            icon: "🔍",
            title: "Akıllı Arama",
            text: "Pozisyon, şehir, ilçe ve çalışma tercihine göre filtre. Otomatik tamamlama destekli.",
          },
          {
            icon: "🔔",
            title: "İş Alarmı",
            text: "Aradığın kriterlerde yeni ilan yayınlandığında anında haberdar ol.",
          },
          {
            icon: "✨",
            title: "AI Asistan",
            text: "Sağ altındaki chat penceresinden 'İzmir'de Frontend' yazıp saniyeler içinde başvur.",
          },
        ].map((f) => (
          <div key={f.title} className="card p-5">
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="font-semibold text-gray-900">{f.title}</h3>
            <p className="text-sm text-gray-600 mt-1">{f.text}</p>
          </div>
        ))}
        </section>
      )}
    </div>
  );
}
