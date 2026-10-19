"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not change password");
        return;
      }
      router.replace("/home");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const field = "w-full custom-input rounded border px-3 py-2";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold">Change password</h1>
        {error && (
          <div className="rounded bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <input
          type="password"
          placeholder="Current password"
          required
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className={field}
        />
        <input
          type="password"
          placeholder="New password"
          required
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          autoComplete="new-password"
          className={field}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className={field}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-green-700 hover:bg-green-800 hoverEffect py-2 text-white disabled:opacity-50"
        >
          {loading ? "Saving..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
