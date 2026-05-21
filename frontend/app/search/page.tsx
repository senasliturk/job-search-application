"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import JobCard from "@/components/JobCard";
import { search } from "@/lib/api";
import type { Job, Page } from "@/lib/api";

const FILTER_LABELS: Record<string, string> = {
  position: "Pozisyon",
  city: "Şehir",
  country: "Ülke",
  town: "İlçe",
  work_preference: "Çalışma Tercihi",
};

const WP_LABEL: Record<string, string> = {
  onsite: "İş Yerinde",
  remote: "Uzaktan",
  hybrid: "Hibrit",
};

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<Page<Job> | null>(null);
  const [loading, setLoading] = useState(true);

  const filters = {
    position: params.get("position") ?? "",
    city: params.get("city") ?? "",
    country: params.get("country") ?? "",
    town: params.get("town") ?? "",
    work_preference: params.get("work_preference") ?? "",
    page: Number(params.get("page") ?? "1"),
  };

  useEffect(() => {
    setLoading(true);
    search
      .run(filters as any)
      .then((r) => setData(r.page))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  function update(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.set("page", "1");
    router.push(`/search?${next}`);
  }

  function removeFilter(name: string) {
    const next = new URLSearchParams(params.toString());
    next.delete(name);
    router.push(`/search?${next}`);
  }

  function clearAll() {
    router.push("/search");
  }

  const activeFilters = Object.entries(filters).filter(
    ([k, v]) => v && k !== "page",
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
      {/* ── Filter pane ──────────────────────────────────────────── */}
      <aside className="card p-5 space-y-5 h-fit md:sticky md:top-20">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand">
              <path d="M3 6h18M6 12h12M10 18h4" />
            </svg>
            Filtreler
          </h2>
          {activeFilters.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-brand hover:text-brand-dark font-medium"
            >
              Temizle
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Ülke
            </label>
            <input
              value={filters.country}
              onChange={(e) => update("country", e.target.value)}
              className="input"
              placeholder="Türkiye"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Şehir
            </label>
            <input
              value={filters.city}
              onChange={(e) => update("city", e.target.value)}
              className="input"
              placeholder="örn. İzmir"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              İlçe
            </label>
            <input
              value={filters.town}
              onChange={(e) => update("town", e.target.value)}
              className="input"
              placeholder="örn. Torbalı"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-600 mb-2">
            Çalışma Tercihi
          </div>
          <div className="space-y-1">
            {(["onsite", "remote", "hybrid"] as const).map((wp) => {
              const active = filters.work_preference === wp;
              return (
                <button
                  key={wp}
                  onClick={() => update("work_preference", active ? "" : wp)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg flex items-center gap-2 transition ${
                    active
                      ? "bg-brand/10 text-brand font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      active ? "bg-brand border-brand" : "border-gray-300"
                    }`}
                  >
                    {active && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </span>
                  {WP_LABEL[wp]}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Results ──────────────────────────────────────────────── */}
      <section>
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {loading ? "…" : data?.total ?? 0}{" "}
            {[filters.city, filters.position].filter(Boolean).join(" ")} İş
            İlanları
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            En güncel ilanlar önce gösteriliyor
          </p>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 font-medium">
              Seçili Filtreler ({activeFilters.length})
            </span>
            {activeFilters.map(([k, v]) => (
              <button
                key={k}
                onClick={() => removeFilter(k)}
                className="group inline-flex items-center gap-1.5 bg-brand/10 text-brand-700 text-xs font-medium pl-3 pr-2 py-1.5 rounded-full hover:bg-brand/20 transition"
                title={`${FILTER_LABELS[k] ?? k}: kaldır`}
              >
                {k === "work_preference" ? WP_LABEL[String(v)] ?? v : v}
                <span className="w-4 h-4 rounded-full bg-brand/20 group-hover:bg-brand/40 flex items-center justify-center transition">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-200"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-2">🔎</div>
            <h3 className="font-semibold text-gray-900">Sonuç bulunamadı</h3>
            <p className="text-sm text-gray-500 mt-1">
              Filtreleri değiştirmeyi veya temizlemeyi dene.
            </p>
            {activeFilters.length > 0 && (
              <button onClick={clearAll} className="btn-secondary mt-4 text-sm">
                Filtreleri Temizle
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {data.items.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && (data.page > 1 || data.has_next) && (
          <div className="mt-6 flex items-center justify-between gap-2">
            <button
              disabled={data.page <= 1}
              onClick={() => {
                const next = new URLSearchParams(params.toString());
                next.set("page", String(filters.page - 1));
                router.push(`/search?${next}`);
              }}
              className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Önceki
            </button>
            <span className="text-sm text-gray-500">Sayfa {data.page}</span>
            <button
              disabled={!data.has_next}
              onClick={() => {
                const next = new URLSearchParams(params.toString());
                next.set("page", String(filters.page + 1));
                router.push(`/search?${next}`);
              }}
              className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Sonraki →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">Yükleniyor…</div>}>
      <SearchInner />
    </Suspense>
  );
}
