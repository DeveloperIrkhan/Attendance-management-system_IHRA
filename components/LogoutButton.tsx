"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { queueToast } from "@/components/toast/Toaster";
import Spinner from "@/components/Spinner";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      queueToast(
        res.ok ? "Logged out." : "Could not log out. Please try again.",
        res.ok ? "success" : "error",
      );
    } catch {
      queueToast("Could not log out. Please try again.", "error");
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <>
      {busy && <Spinner />}
      <button
        onClick={logout}
        disabled={busy}
        title="Log out"
        className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm duration-300 text-red-600 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-green-500 disabled:opacity-50"
      >
        <LogOut size={16} aria-hidden />
        <span className="hidden sm:inline">Log out</span>
      </button>
    </>
  );
}
