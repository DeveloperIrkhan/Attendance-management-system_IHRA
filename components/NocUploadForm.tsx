"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NOC_ACCEPT, NOC_MAX_BYTES } from "@/lib/noc/file";

type Props = {
  id: string;
  /** "Upload NOC" for a new one, "Replace file" for an issued one */
  label: string;
};

/** HR / Admin pick the NOC file and upload it. The server checks the file again. */
export default function NocUploadForm({ id, label }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    if (file.size > NOC_MAX_BYTES) {
      setError("The file is too large. The limit is 3 MB.");
      return;
    }
    if (!window.confirm(`${label}: ${file.name}?`)) return;

    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/noc/${id}/document`, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not upload the file.");
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept={NOC_ACCEPT}
        aria-label="NOC file"
        className="max-w-56 text-xs"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded border border-green-800 bg-green-800 px-3 py-1 text-xs text-white hover:bg-white hover:text-green-800 disabled:opacity-50"
      >
        {busy ? "Uploading..." : label}
      </button>
      {error && <span className="basis-full text-xs text-red-600">{error}</span>}
    </form>
  );
}
