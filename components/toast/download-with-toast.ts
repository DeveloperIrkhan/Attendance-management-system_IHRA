"use client";

import { notifyError, notifySuccess } from "./Toaster";

/** Filename from the server's Content-Disposition header, when it has one. */
function fileNameFrom(response: Response, fallback: string) {
  const value = response.headers.get("content-disposition") ?? "";
  const match = value.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Downloads use fetch instead of a plain link so a failed export can be reported: an <a> to an
 * API error just replaces the page with JSON and gives the user no explanation.
 */
export async function downloadWithToast(
  url: string,
  label: string,
  onBusyChange?: (busy: boolean) => void,
) {
  onBusyChange?.(true);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      notifyError(data.error ?? `${label} could not be downloaded.`);
      return;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileNameFrom(response, label);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    notifySuccess(`${label} downloaded.`);
  } catch {
    notifyError("Could not reach the server. Check your connection and try again.");
  } finally {
    onBusyChange?.(false);
  }
}
