"use client";
import { useEffect, useState } from "react";
import { alerts as alertsApi } from "@/lib/api";

export default function AlertsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Türkiye");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setItems(await alertsApi.list());
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await alertsApi.create({
        keywords: keyword ? [keyword] : [],
        city: city || null,
        country: country || null,
      });
      setKeyword("");
      setCity("");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await alertsApi.delete(id);
    load();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 bg-brand/10 text-brand-700 text-xs font-medium px-3 py-1.5 rounded-full mb-3">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          İş Alarmı
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Sana uygun yeni ilanları kaçırma
        </h1>
        <p className="text-gray-600 mt-1 text-sm">
          Anahtar kelime ve konum belirle — eşleşen ilan yayınlandığında haberdar olalım.
        </p>
      </div>

      {/* Create form */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Yeni Alarm Oluştur</h2>
        <form onSubmit={create} className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Anahtar Kelime
            </label>
            <input
              required
              placeholder="örn. Frontend Developer"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Şehir
            </label>
            <input
              placeholder="örn. İzmir"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Ülke
            </label>
            <input
              placeholder="Türkiye"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full disabled:opacity-60"
            >
              {busy ? "Ekleniyor…" : "Alarm Ekle"}
            </button>
          </div>
        </form>
        {err && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
            {err}
          </div>
        )}
      </div>

      {/* List */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center justify-between">
          Mevcut Alarmlarım
          <span className="text-xs text-gray-500 font-normal">
            {items.length} alarm
          </span>
        </h2>
        {items.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <div className="text-4xl mb-2">🔔</div>
            <div className="text-sm">Henüz alarmın yok.</div>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((a) => (
              <li
                key={a.id}
                className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 flex justify-between items-start gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {(a.keywords || []).join(", ") || "(anahtar kelime yok)"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                    {a.city && (
                      <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        📍 {a.city}
                      </span>
                    )}
                    {a.country && (
                      <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        🌍 {a.country}
                      </span>
                    )}
                    {a.work_preference && (
                      <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        💼 {a.work_preference}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(a.id)}
                  className="shrink-0 w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition"
                  aria-label="Alarmı sil"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
