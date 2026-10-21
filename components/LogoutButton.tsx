"use client";

import { LogOut } from "lucide-react";

export default function LogoutButton() {
  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <button
      onClick={logout}
      title="Log out"
      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-500"
    >
      <LogOut size={16} aria-hidden />
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
