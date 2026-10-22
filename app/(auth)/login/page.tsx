"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Spinner from "@/components/Spinner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<boolean>(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        toast.error(data.error?? "login fails!")
        return;
      }
      toast.success("login successfull!")
      router.replace(data.redirectTo);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }
    return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-200 p-4">
      {loading && <Spinner/>}
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg bg-white p-6 shadow-lg"
      >
        <div>
          <h1 className="text-xl font-bold text-center text-green-800">IHRA Attendance System</h1>
          <p className="text-sm text-zinc-500 text-center">Sign in to continue</p>
        </div>
        {error && (
          <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="email">Enter Your Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded px-3 py-2 custom-input"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">Enter Your Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded px-3 py-2 custom-input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="green-button w-full hoverEffect disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}