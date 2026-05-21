"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  firebaseAuth,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
} from "@/lib/firebase";
import { userProfile, admin, type UserProfile } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // ── Display name ────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("");
  const [nameMsg, setNameMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [nameBusy, setNameBusy] = useState(false);

  // ── Education ───────────────────────────────────────────────────────────────
  const [school, setSchool] = useState("");
  const [department, setDepartment] = useState("");
  const [educationStatus, setEducationStatus] = useState<string | null>(null);
  const [classYear, setClassYear] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [eduMsg, setEduMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [eduBusy, setEduBusy] = useState(false);

  // ── CV upload ───────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvMsg, setCvMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ── Password ────────────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // ── Role / Company ──────────────────────────────────────────────────────────
  const [role, setRole] = useState<string | null>(null);
  const [company, setCompany] = useState<any | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [companyMsg, setCompanyMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [companyBusy, setCompanyBusy] = useState(false);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) { setUser(null); return; }
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/login?next=/profile"); return; }
      setUser(u);
      setDisplayName(u.displayName ?? "");

      // Detect role from Firebase custom claims
      const tokenResult = await u.getIdTokenResult(true);
      const userRole = (tokenResult.claims.role as string | undefined) ?? null;
      setRole(userRole);

      try {
        const p = await userProfile.get();
        setProfile(p);
        setSchool(p.school ?? "");
        setDepartment(p.department ?? "");
        setEducationStatus(p.education_status ?? null);
        setClassYear(p.class_year ?? null);
        setExperienceLevel(p.experience_level ?? null);
      } catch { /* empty profile is fine */ }

      // For company / admin users: load their company
      if (userRole === "company" || userRole === "admin") {
        try {
          const companies = await admin.listCompanies();
          const myCompany = companies.find(
            (c: any) => c.name.toLowerCase() === (u.displayName ?? "").toLowerCase()
          ) ?? null;
          if (myCompany) {
            setCompany(myCompany);
            setLogoUrl(myCompany.logo_url ?? "");
            setWebsite(myCompany.website ?? "");
          }
        } catch { /* optional */ }
      }
    });
  }, [router]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setNameBusy(true); setNameMsg(null);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      setNameMsg({ kind: "success", text: "Ad soyad güncellendi." });
    } catch (err: any) {
      setNameMsg({ kind: "error", text: err.message });
    } finally {
      setNameBusy(false);
    }
  }

  async function saveEducation(e: React.FormEvent) {
    e.preventDefault();
    setEduBusy(true); setEduMsg(null);
    const noSchool = educationStatus === "no_degree";
    try {
      const p = await userProfile.update({
        school: noSchool ? null : school.trim() || null,
        department: noSchool ? null : department.trim() || null,
        education_status: educationStatus,
        class_year: educationStatus === "student" ? classYear : null,
        experience_level: experienceLevel,
      });
      setProfile(p);
      if (noSchool) { setSchool(""); setDepartment(""); }
      if (educationStatus !== "student") setClassYear(null);
      setEduMsg({ kind: "success", text: "Eğitim bilgileri güncellendi." });
    } catch {
      setEduMsg({ kind: "error", text: "Kaydedilemedi. Tekrar deneyin." });
    } finally {
      setEduBusy(false);
    }
  }

  async function uploadCv() {
    if (!cvFile) return;
    setCvBusy(true); setCvMsg(null);
    try {
      const p = await userProfile.uploadCv(cvFile);
      setProfile(p);
      setCvFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setCvMsg({ kind: "success", text: `"${cvFile.name}" başarıyla yüklendi.` });
    } catch (err: any) {
      const text = err.message?.includes("413")
        ? "Dosya 5 MB sınırını aşıyor."
        : err.message?.includes("400")
        ? "Yalnızca PDF dosyası yüklenebilir."
        : "Yükleme başarısız. Tekrar deneyin.";
      setCvMsg({ kind: "error", text });
    } finally {
      setCvBusy(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setCvFile(f); setCvMsg(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") { setCvFile(f); setCvMsg(null); }
    else setCvMsg({ kind: "error", text: "Yalnızca PDF dosyası kabul edilir." });
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !user.email) return;
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ kind: "error", text: "Yeni şifreler eşleşmiyor." });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ kind: "error", text: "Şifre en az 6 karakter olmalı." });
      return;
    }
    setPwBusy(true);
    try {
      // Re-authenticate first (Firebase requires recent login for password change)
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      setPwMsg({ kind: "success", text: "Şifreniz başarıyla güncellendi." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const msg =
        err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
          ? "Mevcut şifreniz hatalı."
          : err.message;
      setPwMsg({ kind: "error", text: msg });
    } finally {
      setPwBusy(false);
    }
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setCompanyBusy(true); setCompanyMsg(null);
    try {
      const updated = await admin.updateCompany(company.id, {
        logo_url: logoUrl.trim() || null,
        website: website.trim() || null,
      });
      setCompany(updated);
      setLogoUrl(updated.logo_url ?? "");
      setWebsite(updated.website ?? "");
      setCompanyMsg({ kind: "success", text: "Şirket bilgileri güncellendi." });
    } catch {
      setCompanyMsg({ kind: "error", text: "Kaydedilemedi. Tekrar deneyin." });
    } finally {
      setCompanyBusy(false);
    }
  }

  const isCompany = role === "company" || role === "admin";

  if (user === undefined) {
    return <div className="text-gray-500 text-sm animate-pulse">Yükleniyor…</div>;
  }

  const initials = ((user?.displayName ?? user?.email) || "?").slice(0, 1).toUpperCase();
  const cvDisplayName = profile?.cv_filename
    ? profile.cv_filename.includes("_")
      ? profile.cv_filename.split("_").slice(1).join("_")
      : profile.cv_filename
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand to-fuchsia-500 text-white text-2xl font-bold flex items-center justify-center shadow-md">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user?.displayName || "Profil"}
          </h1>
          <p className="text-sm text-gray-500">{user?.email}</p>
        </div>
      </div>

      {/* Display Name */}
      <div className="card p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          Ad Soyad
        </h2>
        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Görünen Ad</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Adınız Soyadınız"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            />
          </div>
          {nameMsg && <Msg kind={nameMsg.kind} text={nameMsg.text} />}
          <button type="submit" disabled={nameBusy || !displayName.trim()} className="btn-primary disabled:opacity-50">
            {nameBusy ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </form>
      </div>

      {/* Şirket Bilgileri — yalnızca company/admin kullanıcılara */}
      {isCompany && (
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 0 0-4 0v2"/>
              <path d="M8 7V5a2 2 0 0 0-4 0v2"/>
            </svg>
            Şirket Bilgileri
          </h2>
          {!company && (
            <p className="text-sm text-amber-600">
              Hesabınıza bağlı şirket bulunamadı. Görünen adınız kayıtlı şirket adıyla eşleşmeli.
            </p>
          )}
          {company && (
            <form onSubmit={saveCompany} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şirket Adı</label>
                <p className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">{company.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Web Sitesi</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                />
              </div>
              {companyMsg && <Msg kind={companyMsg.kind} text={companyMsg.text} />}
              <button type="submit" disabled={companyBusy} className="btn-primary disabled:opacity-50">
                {companyBusy ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Eğitim Bilgileri — yalnızca aday kullanıcılara */}
      {!isCompany && <div className="card p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
          Eğitim Bilgileri
        </h2>
        <form onSubmit={saveEducation} className="space-y-4">
          {educationStatus !== "no_degree" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Okul / Üniversite</label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="İstanbul Üniversitesi"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bölüm</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Bilgisayar Mühendisliği"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                />
              </div>
            </>
          )}

          {/* Eğitim Durumu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Eğitim Durumu</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "student",   label: "🎓 Öğrenciyim" },
                { value: "graduate",  label: "✅ Mezun" },
                { value: "no_degree", label: "🔧 Üniversite Okumadım" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const next = educationStatus === value ? null : value;
                    setEducationStatus(next);
                    // Sınıf bilgisi yalnızca öğrenciye özgü
                    if (next !== "student") setClassYear(null);
                    // Okul alanları yalnızca üniversite okumadıysa kapanır
                    if (next === "no_degree") { setSchool(""); setDepartment(""); }
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition
                    ${educationStatus === value
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:border-brand hover:text-brand"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sınıf Seçimi — yalnızca öğrencilere */}
          {educationStatus === "student" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sınıf</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "prep",   label: "🎯 Hazırlık" },
                  { value: "year_1", label: "1. Sınıf" },
                  { value: "year_2", label: "2. Sınıf" },
                  { value: "year_3", label: "3. Sınıf" },
                  { value: "year_4", label: "4. Sınıf" },
                  { value: "year_5", label: "5. Sınıf" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setClassYear(classYear === value ? null : value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition
                      ${classYear === value
                        ? "bg-brand text-white border-brand shadow-sm"
                        : "bg-white text-gray-600 border-gray-300 hover:border-brand hover:text-brand"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deneyim Seviyesi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Deneyim Seviyesi</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "new_grad", label: "🌱 New Grad" },
                { value: "junior",   label: "🚀 Junior" },
                { value: "mid",      label: "⚡ Mid" },
                { value: "senior",   label: "🏆 Senior" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExperienceLevel(experienceLevel === value ? null : value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition
                    ${experienceLevel === value
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:border-brand hover:text-brand"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {eduMsg && <Msg kind={eduMsg.kind} text={eduMsg.text} />}
          <button type="submit" disabled={eduBusy} className="btn-primary disabled:opacity-50">
            {eduBusy ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </form>
      </div>}

      {/* CV Yükle — yalnızca aday kullanıcılara */}
      {!isCompany && <div className="card p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9,15 12,12 15,15"/>
          </svg>
          CV / Özgeçmiş
        </h2>

        {cvDisplayName && (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600 shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            <span className="text-emerald-700 font-medium truncate">{cvDisplayName}</span>
            <span className="text-emerald-500 text-xs ml-auto shrink-0">Mevcut CV</span>
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition
            ${dragOver ? "border-brand bg-brand/5" : "border-gray-200 hover:border-brand/50 hover:bg-gray-50"}`}
        >
          <input ref={fileRef} type="file" accept="application/pdf" onChange={onFileChange} className="hidden" />
          <svg className="mx-auto mb-2 text-gray-400" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17,8 12,3 7,8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {cvFile ? (
            <p className="text-sm font-medium text-brand">{cvFile.name}</p>
          ) : (
            <>
              <p className="text-sm text-gray-600">PDF dosyanızı buraya sürükleyin</p>
              <p className="text-xs text-gray-400 mt-1">veya tıklayarak seçin · Maks. 5 MB</p>
            </>
          )}
        </div>

        {cvMsg && <Msg kind={cvMsg.kind} text={cvMsg.text} />}
        <button type="button" onClick={uploadCv} disabled={!cvFile || cvBusy} className="btn-primary disabled:opacity-50">
          {cvBusy ? "Yükleniyor…" : "CV'yi Yükle"}
        </button>
      </div>}

      {/* Change Password */}
      <div className="card p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Şifre Değiştir
        </h2>
        <form onSubmit={savePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mevcut Şifre</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Yeni Şifre</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Yeni Şifre (Tekrar)</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
          </div>
          {pwMsg && <Msg kind={pwMsg.kind} text={pwMsg.text} />}
          <button type="submit" disabled={pwBusy} className="btn-primary disabled:opacity-50">
            {pwBusy ? "Güncelleniyor…" : "Şifreyi Güncelle"}
          </button>
        </form>
      </div>

      {/* Account info */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/>
          </svg>
          Hesap Bilgileri
        </h2>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-28 text-gray-400">E-posta</span>
            <span className="font-medium text-gray-800">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-28 text-gray-400">Kullanıcı ID</span>
            <span className="font-mono text-xs text-gray-500">{user?.uid}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-28 text-gray-400">E-posta Doğrulama</span>
            {user?.emailVerified ? (
              <span className="text-emerald-600 font-medium">✓ Doğrulandı</span>
            ) : (
              <span className="text-amber-600">Doğrulanmadı</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Msg({ kind, text }: { kind: "success" | "error"; text: string }) {
  return (
    <div className={`text-sm px-3 py-2.5 rounded-lg border ${
      kind === "success"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-red-50 text-red-700 border-red-200"
    }`}>
      {text}
    </div>
  );
}
