"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { firebaseAuth, onAuthStateChanged, signOut, type User } from "@/lib/firebase";

export default function AuthBadge() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const a = firebaseAuth();
    if (!a) return;
    return onAuthStateChanged(a, setUser);
  }, []);
  if (!user) {
    return (
      <Link href="/login" className="text-brand font-medium">
        Giriş Yap / Üye Ol
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-700">{user.email}</span>
      <button
        onClick={() => signOut(firebaseAuth()!)}
        className="text-gray-500 hover:text-brand"
      >
        Çıkış
      </button>
    </div>
  );
}
