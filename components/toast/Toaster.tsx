"use client";

import { useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";

/** One place for the look and timing of every notification in the app. */
const OPTIONS = {
  position: "top-right",
  autoClose: 3500,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: "colored",
} as const;

export function notifySuccess(message: string) {
  toast.success(message, OPTIONS);
}

export function notifyError(message: string) {
  toast.error(message, OPTIONS);
}

/**
 * For operations that end in a full page load (logout): the ToastContainer is recreated on
 * the next page, so the message is parked in the session until the new container mounts.
 */
const FLASH_KEY = "ihra-toast";

export function queueToast(
  message: string,
  kind: "success" | "error" = "success",
) {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, kind }));
  } catch {
    // Storage can be disabled; the operation itself still succeeded.
  }
}

export default function Toaster() {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLASH_KEY);
      if (!raw) return;
      sessionStorage.removeItem(FLASH_KEY);
      const { message, kind } = JSON.parse(raw) as {
        message: string;
        kind: "success" | "error";
      };
      if (kind === "error") notifyError(message);
      else notifySuccess(message);
    } catch {
      // Ignore a corrupt or unavailable flash message.
    }
  }, []);

  return <ToastContainer {...OPTIONS} />;
}
