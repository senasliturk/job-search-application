"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  firebaseAuth,
  onAuthStateChanged,
  signOut,
  type User,
} from "@/lib/firebase";
import { notifications as notifApi, type AppNotification } from "@/lib/api";

type AuthState = {
  user: User | null;
  role: string | null; // "admin" | "company" | null
};

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ user: null, role: null });
  const [open, setOpen] = useState(false); // mobile menu
  const [profileOpen, setProfileOpen] = useState(false); // avatar dropdown
  const [notifOpen, setNotifOpen] = useState(false); // notification dropdown
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setState({ user: null, role: null });
        setNotifs([]);
        return;
      }
      try {
        const tok = await u.getIdTokenResult(true);
        const role = (tok.claims.role as string | undefined) ?? null;
        setState({ user: u, role });
      } catch {
        setState({ user: u, role: null });
      }
    });
  }, []);

  // Poll notifications every 60s for regular (non-company/admin) users
  useEffect(() => {
    const isCandidate = state.user && state.role !== "admin" && state.role !== "company";
    if (!isCandidate) {
      setNotifs([]);
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const fetchNotifs = () => {
      notifApi.list().then(setNotifs).catch(() => {/* silent */});
    };
    fetchNotifs();
    pollRef.current = setInterval(fetchNotifs, 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state.user, state.role]);

  const unreadCount = notifs.filter((n) => !n.read).length;
  const isAdminish = state.role === "admin" || state.role === "company";

  const linkClass = (href: string) =>
    `relative px-1 py-2 transition-colors ${
      pathname === href || (href !== "/" && pathname?.startsWith(href))
        ? "text-brand font-medium"
        : "text-gray-600 hover:text-gray-900"
    }`;

  const handleNotifClick = async (n: AppNotification) => {
    if (!n.read) {
      await notifApi.markRead(n.id).catch(() => {});
      setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
    if (n.jobs.length === 1) {
      router.push(`/jobs/${n.jobs[0].id}`);
    } else {
      router.push("/alerts");
    }
    setNotifOpen(false);
  };

  const handleMarkAllRead = async () => {
    await notifApi.markAllRead().catch(() => {});
    setNotifs((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-1 font-bold text-xl tracking-tight"
        >
          <span className="text-brand">kariyer</span>
          <span className="text-gray-900">.</span>
          <span className="bg-gradient-to-r from-brand to-fuchsia-500 bg-clip-text text-transparent">
            4458
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm ml-2">
          {isAdminish ? (
            <>
              <Link href="/my-jobs" className={linkClass("/my-jobs")}>
                İlanlarım
              </Link>
              <Link href="/applications" className={linkClass("/applications")}>
                Başvuranlar
              </Link>
              {state.role === "admin" && (
                <Link
                  href="/admin"
                  className={`${linkClass("/admin")} inline-flex items-center gap-1.5`}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Admin
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/search" className={linkClass("/search")}>
                İlanlar
              </Link>
              {state.user && (
                <Link href="/alerts" className={linkClass("/alerts")}>
                  İş Alarmı
                </Link>
              )}
            </>
          )}
        </nav>

        {/* Right side: auth */}
        <div className="ml-auto flex items-center gap-3">
          {state.user ? (
            <div className="flex items-center gap-2">

              {/* Notification bell – only for candidate users */}
              {!isAdminish && (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="relative p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
                    aria-label="Bildirimler"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-40 overflow-hidden animate-fade-in">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                          <span className="text-sm font-semibold text-gray-900">Bildirimler</span>
                          {unreadCount > 0 && (
                            <button
                              onClick={handleMarkAllRead}
                              className="text-xs text-brand hover:underline"
                            >
                              Tümünü okundu işaretle
                            </button>
                          )}
                        </div>

                        {/* List */}
                        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                          {notifs.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-400">
                              Henüz bildirim yok
                            </div>
                          ) : (
                            notifs.map((n) => (
                              <button
                                key={n.id}
                                onClick={() => handleNotifClick(n)}
                                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${!n.read ? "bg-brand/5" : ""}`}
                              >
                                <div className="flex items-start gap-2">
                                  {!n.read && (
                                    <span className="mt-1.5 w-2 h-2 rounded-full bg-brand flex-shrink-0" />
                                  )}
                                  <div className={!n.read ? "" : "ml-4"}>
                                    <p className="text-sm font-medium text-gray-900 leading-snug">
                                      {n.subject}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                      {n.body}
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-1">
                                      {new Date(n.created_at).toLocaleDateString("tr-TR", {
                                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                                      })}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>

                        {notifs.length > 0 && (
                          <div className="border-t border-gray-100 px-4 py-2.5 text-center">
                            <Link
                              href="/alerts"
                              onClick={() => setNotifOpen(false)}
                              className="text-xs text-brand hover:underline"
                            >
                              Tüm alarmlarım →
                            </Link>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Avatar + dropdown */}
              <div className="hidden sm:block relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-fuchsia-500 text-white text-sm font-semibold flex items-center justify-center shadow-sm">
                    {(state.user.displayName ?? state.user.email ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="text-sm leading-tight text-left">
                    <div className="text-gray-900 font-medium">
                      {state.user.email}
                    </div>
                    {state.role && (
                      <div className="text-xs text-brand uppercase tracking-wide">
                        {state.role}
                      </div>
                    )}
                  </div>
                </button>

                {/* Dropdown */}
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-40 py-1 animate-fade-in">
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <p className="text-xs font-medium text-gray-500">Oturum açıldı</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {state.user.displayName || state.user.email}
                        </p>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                        </svg>
                        Profilim
                      </Link>
                      <button
                        onClick={() => { setProfileOpen(false); signOut(firebaseAuth()!); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Çıkış Yap
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile: just sign-out */}
              <button
                onClick={() => signOut(firebaseAuth()!)}
                className="sm:hidden text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                Çıkış
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm shadow-brand/20 transition"
            >
              Giriş Yap / Üye Ol
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 -mr-2 text-gray-700"
            onClick={() => setOpen(!open)}
            aria-label="Menüyü aç"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t bg-white">
          <nav className="px-4 py-3 flex flex-col gap-1 text-sm">
            {isAdminish ? (
              <>
                <Link
                  href="/my-jobs"
                  onClick={() => setOpen(false)}
                  className="px-2 py-2 rounded hover:bg-gray-50"
                >
                  İlanlarım
                </Link>
                <Link
                  href="/applications"
                  onClick={() => setOpen(false)}
                  className="px-2 py-2 rounded hover:bg-gray-50"
                >
                  Başvuranlar
                </Link>
                {state.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="px-2 py-2 rounded hover:bg-gray-50 inline-flex items-center gap-1.5"
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Admin
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/search"
                  onClick={() => setOpen(false)}
                  className="px-2 py-2 rounded hover:bg-gray-50"
                >
                  İlanlar
                </Link>
                {state.user && (
                  <Link
                    href="/alerts"
                    onClick={() => setOpen(false)}
                    className="px-2 py-2 rounded hover:bg-gray-50"
                  >
                    İş Alarmı
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
