"use client";
import { firebaseAuth } from "./firebase";

const BASE = process.env.NEXT_PUBLIC_API_GATEWAY_URL || "";

async function bearer(): Promise<string | null> {
  const auth = firebaseAuth();
  if (!auth) return null;
  // Wait for Firebase Auth to finish loading the persisted session
  await auth.authStateReady();
  const u = auth.currentUser;
  if (!u) return null;
  return await u.getIdToken();
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = await bearer().catch(() => null);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const url = path.startsWith("http") ? path : `${BASE || ""}${path}`;
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  // 204 No Content or empty body – return undefined without trying to parse JSON
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

// ----- typed wrappers -----
export type Job = {
  id: string;
  title: string;
  description: string;
  city: string;
  country: string;
  town?: string | null;
  work_preference: "onsite" | "remote" | "hybrid";
  position_level: string;
  application_count: number;
  last_updated: string;
  company: { id: string; name: string; logo_url?: string | null };
};

export type Page<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
};

export const jobs = {
  list: (q: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== "" && sp.set(k, String(v)));
    return api<Page<Job>>(`/api/v1/jobs?${sp}`);
  },
  byId: (id: string) => api<Job>(`/api/v1/jobs/${id}`),
  related: (id: string) => api<Job[]>(`/api/v1/jobs/${id}/related`),
  featured: (city?: string) =>
    api<Job[]>(`/api/v1/jobs/featured${city ? `?city=${encodeURIComponent(city)}` : ""}`),
  apply: (id: string) => api<unknown>(`/api/v1/jobs/${id}/apply`, { method: "POST" }),
  myApplication: (id: string) => api<unknown>(`/api/v1/jobs/${id}/my-application`),
  autocompletePositions: (q: string) =>
    api<string[]>(`/api/v1/jobs/autocomplete/positions?q=${encodeURIComponent(q)}`),
  autocompleteCities: (q: string) =>
    api<string[]>(`/api/v1/jobs/autocomplete/cities?q=${encodeURIComponent(q)}`),
};

export const search = {
  run: (q: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== "" && sp.set(k, String(v)));
    return api<{ page: Page<Job>; stored_search_id: string | null }>(`/api/v1/search?${sp}`);
  },
  recent: () =>
    api<{ id: string; query_position?: string; query_city?: string; searched_at: string }[]>(
      "/api/v1/search/recent",
    ),
};

export const alerts = {
  list: () => api<any[]>("/api/v1/alerts"),
  create: (body: any) =>
    api<any>("/api/v1/alerts", { method: "POST", body: JSON.stringify(body) }),
  delete: (id: string) => api<void>(`/api/v1/alerts/${id}`, { method: "DELETE" }),
};

export type AppNotification = {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  jobs: { id: string; title: string; city: string }[];
  read: boolean;
  created_at: string;
};

export const notifications = {
  list: () => api<AppNotification[]>("/api/v1/alerts/notifications"),
  markRead: (id: string) =>
    api<AppNotification>(`/api/v1/alerts/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () =>
    api<void>("/api/v1/alerts/notifications/read-all", { method: "POST" }),
};

export const agent = {
  chat: (messages: { role: string; content: string }[]) =>
    api<{ reply: string; jobs: any[] }>("/api/v1/agent/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),
};

export const admin = {
  createCompany: (name: string) =>
    api<any>(`/api/v1/admin/companies?name=${encodeURIComponent(name)}`, { method: "POST" }),
  listCompanies: () => api<any[]>("/api/v1/admin/companies"),
  updateCompany: (id: string, body: { logo_url?: string | null; website?: string | null }) =>
    api<any>(`/api/v1/admin/companies/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  listJobs: (companyId: string, page = 1, pageSize = 50) =>
    api<Page<Job>>(`/api/v1/jobs?company_id=${encodeURIComponent(companyId)}&page=${page}&page_size=${pageSize}`),
  listApplications: (companyId: string) =>
    api<any[]>(`/api/v1/admin/jobs/applications?company_id=${encodeURIComponent(companyId)}`),
  createJob: (body: any) =>
    api<Job>("/api/v1/admin/jobs", { method: "POST", body: JSON.stringify(body) }),
  updateJob: (id: string, body: any) =>
    api<Job>(`/api/v1/admin/jobs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteJob: (id: string) =>
    api<void>(`/api/v1/admin/jobs/${id}`, { method: "DELETE" }),
};

export type UserProfile = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  school: string | null;
  department: string | null;
  cv_filename: string | null;
  education_status: string | null;
  class_year: string | null;
  experience_level: string | null;
};

export const userProfile = {
  get: () => api<UserProfile>("/api/v1/profile"),

  update: (body: { school?: string | null; department?: string | null; education_status?: string | null; class_year?: string | null; experience_level?: string | null }) =>
    api<UserProfile>("/api/v1/profile", { method: "PUT", body: JSON.stringify(body) }),

  uploadCv: async (file: File): Promise<UserProfile> => {
    const auth = (await import("./firebase")).firebaseAuth();
    const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
    const form = new FormData();
    form.append("file", file);
    const url = `${BASE || ""}/api/v1/profile/cv`;
    const res = await fetch(url, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json();
  },

  downloadCv: async (userId: string, filename: string): Promise<void> => {
    const auth = (await import("./firebase")).firebaseAuth();
    const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
    const url = `${BASE || ""}/api/v1/profile/cv/${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  },
};

export const savedJobs = {
  list: () => api<Job[]>("/api/v1/profile/saved-jobs"),
  isSaved: (jobId: string) => api<{ saved: boolean }>(`/api/v1/profile/saved-jobs/${jobId}`),
  save: (jobId: string) => api<{ saved: boolean }>(`/api/v1/profile/saved-jobs/${jobId}`, { method: "POST" }),
  unsave: (jobId: string) => api<void>(`/api/v1/profile/saved-jobs/${jobId}`, { method: "DELETE" }),
};

