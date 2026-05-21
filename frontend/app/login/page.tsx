"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  firebaseAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "@/lib/firebase";

type UserType = "candidate" | "employer";
type FormMode = "login" | "signup";

const CANDIDATE_PERKS = [
  "Sınırsız iş alarmı oluştur",
  "Son aramaların kayıtlı kalsın",
  "Tek tıkla başvuru yap",
];

const EMPLOYER_PERKS = [
  "İlanlarını kolayca yayınla ve yönet",
  "Başvuruları tek ekrandan takip et",
  "AI asistan ile aday eşleştirme",
];

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";

  const [userType, setUserType] = useState<UserType>("candidate");
  const [mode, setMode]         = useState<FormMode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany]   = useState("");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState("");

  function switchType(t: UserType) {
    setUserType(t);
    setErr("");
  }

  function switchMode(m: FormMode) {
    setMode(m);
    setErr("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const auth = firebaseAuth();
    if (!auth) {
      setErr("Firebase yapılandırılmadı (.env.local kontrol et).");
      setBusy(false);
      return;
    }
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Store company name (employer) or leave displayName empty (candidate)
        if (userType === "employer" && company.trim()) {
          await updateProfile(cred.user, { displayName: company.trim() });
        }
      }
      router.push(next);
    } catch (e: any) {
      const msg = String(e.message ?? "");
      if (msg.includes("invalid-credential") || msg.includes("wrong-password"))
        setErr("Email veya şifre hatalı.");
      else if (msg.includes("user-not-found"))
        setErr("Bu email ile kayıtlı kullanıcı yok. Üye Ol sekmesini dene.");
      else if (msg.includes("email-already-in-use"))
        setErr("Bu email zaten kayıtlı. Giriş Yap sekmesini dene.");
      else if (msg.includes("weak-password"))
        setErr("Şifre en az 6 karakter olmalı.");
      else if (msg.includes("invalid-email"))
        setErr("Geçerli bir email adresi gir.");
      else setErr(msg.replace("Firebase: ", ""));
    } finally {
      setBusy(false);
    }
  }

  const isEmployer = userType === "employer";
  const perks = isEmployer ? EMPLOYER_PERKS : CANDIDATE_PERKS;

  return (
    <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto py-8">
      {/* ── Left: marketing copy (changes with userType) ─────────── */}
      <div className="hidden lg:block">
        <div className="inline-flex items-center gap-1.5 bg-brand/10 text-brand-700 text-xs font-medium px-3 py-1.5 rounded-full mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
          kariyer.4458
        </div>

        {isEmployer ? (
          <>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 leading-tight">
              En iyi adayı{" "}
              <span className="bg-gradient-to-r from-brand to-fuchsia-500 bg-clip-text text-transparent">
                saniyeler içinde
              </span>{" "}
              bul.
            </h1>
            <p className="mt-4 text-gray-600 leading-relaxed">
              İlanlarını yayınla, başvuruları takip et, AI destekli arama ile
              doğru pozisyona doğru adayı eşleştir.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 leading-tight">
              Tek hesapla{" "}
              <span className="bg-gradient-to-r from-brand to-fuchsia-500 bg-clip-text text-transparent">
                kariyerini
              </span>{" "}
              yönet.
            </h1>
            <p className="mt-4 text-gray-600 leading-relaxed">
              İş alarmı kur, başvurularını takip et, AI asistanla saniyeler
              içinde başvur. Hesabın olmadan da arama yapabilirsin.
            </p>
          </>
        )}

        <ul className="mt-6 space-y-2.5 text-sm text-gray-700">
          {perks.map((t) => (
            <li key={t} className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </span>
              {t}
            </li>
          ))}
        </ul>

        {isEmployer && (
          <div className="mt-8 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <strong>Not:</strong> Kayıt sonrası şirket hesabınız admin onayıyla
            aktive edilir. Onay genellikle 1 iş günü içinde tamamlanır.
          </div>
        )}
      </div>

      {/* ── Right: form ────────────────────────────────────────── */}
      <div className="w-full max-w-md mx-auto card p-6 sm:p-8 animate-fade-in">
        {/* User type selector */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => switchType("candidate")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium border transition ${
              !isEmployer
                ? "bg-brand text-white border-brand shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            İş Arayan
          </button>
          <button
            type="button"
            onClick={() => switchType("employer")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium border transition ${
              isEmployer
                ? "bg-brand text-white border-brand shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
            İşveren
          </button>
        </div>

        {/* Login / Signup tab switcher */}
        <div className="bg-gray-100 rounded-xl p-1 grid grid-cols-2 text-sm font-medium mb-6">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`py-2 rounded-lg transition ${
                mode === m
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {m === "login" ? "Giriş Yap" : "Üye Ol"}
            </button>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {mode === "login"
            ? isEmployer ? "İşveren girişi" : "Tekrar hoş geldin"
            : isEmployer ? "İşveren hesabı oluştur" : "Bize katıl"}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {mode === "login"
            ? "Hesabına giriş yap ve devam et."
            : isEmployer
              ? "Kayıt sonrası şirket hesabınız admin onayıyla aktive edilir."
              : "Email ve şifrenle saniyeler içinde hesap aç."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          {/* Company name — only for employer signup */}
          {isEmployer && mode === "signup" && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Şirket Adı
              </label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Şirketinizin adı"
                className="input"
                autoComplete="organization"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isEmployer ? "sirket@ornek.com" : "ornek@gmail.com"}
              className="input"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Şifre
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 6 karakter"
              className="input"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
            />
          </div>

          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2.5">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full disabled:opacity-60"
          >
            {busy
              ? "İşleniyor…"
              : mode === "login"
                ? "Giriş Yap"
                : "Hesap Oluştur"}
          </button>
        </form>

        <p className="mt-5 text-xs text-gray-500 text-center">
          Hesap açarak{" "}
          <Link href="#" className="text-brand hover:underline">
            Kullanım Şartları
          </Link>
          'nı kabul etmiş olursun.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">Yükleniyor…</div>}>
      <LoginInner />
    </Suspense>
  );
}

