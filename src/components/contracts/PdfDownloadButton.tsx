"use client";

import { useState } from "react";

interface Props {
  contractId: string;
  filename: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
}

// iOS Safari (and especially PWAs running in standalone display mode) ignore
// Content-Disposition: attachment and the <a download> attribute for PDFs —
// they render the PDF inline in the standalone shell, leaving the rep with
// no back button and no way to save the file. Fetch the PDF as a Blob and
// route it through the native share sheet (navigator.share with files) so
// iOS lets the user save to Files / mail / print without leaving the app.
// Fall back to a Blob-URL download on platforms without file-share support.
export function PdfDownloadButton({
  contractId,
  filename,
  children,
  className,
  title,
  ariaLabel,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/pdf`);
      if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "application/pdf" });

      // canShare({files}) is the only reliable feature-detect — `navigator.share`
      // is defined on platforms that reject file payloads.
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (err) {
          if ((err as Error).name === "AbortError") return; // user cancelled the share sheet
          // Otherwise fall through to Blob-URL fallback below.
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Couldn't download the PDF. Please try again or contact support.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={className}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
