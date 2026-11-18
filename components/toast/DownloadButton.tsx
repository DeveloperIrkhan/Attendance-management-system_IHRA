"use client";

import { useState } from "react";
import Spinner from "@/components/Spinner";
import { downloadWithToast } from "./download-with-toast";

type Props = {
  href: string;
  label: React.ReactNode;
  /** used as the fallback file name and in the success toast */
  name: string;
  className?: string;
  /** for tests and assistive technology */
  ariaLabel?: string;
};

export default function DownloadButton({
  href,
  label,
  name,
  className,
  ariaLabel,
}: Props) {
  const [busy, setBusy] = useState(false);

  return (
    <>
      {busy && <Spinner />}
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={busy}
        className={className}
        onClick={() => void downloadWithToast(href, name, setBusy)}
      >
        {label}
      </button>
    </>
  );
}
