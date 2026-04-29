"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Title shown in the modal header */
  title?: string;
  /** Called with a JPEG Blob when the user accepts a captured photo */
  onCapture: (file: File) => void | Promise<void>;
  /** Called when the user closes / cancels */
  onClose: () => void;
  /** Suggested filename the produced File will use */
  filename?: string;
}

/**
 * In-app camera capture — opens a live preview inside Salta (no OS sheet),
 * lets the user take a photo, review/retake, and upload. Falls back gracefully
 * if the browser doesn't support getUserMedia or permission is denied.
 *
 * Usage:
 *   {open && <CameraCaptureModal onCapture={handleFile} onClose={() => setOpen(false)} />}
 */
export default function CameraCaptureModal({ title = "Take Photo", onCapture, onClose, filename }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<"requesting" | "live" | "preview" | "uploading" | "error">("requesting");
  const [error, setError] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  // Request the back-facing camera when the modal opens
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (mounted) {
          setError("This browser doesn't support in-app camera. Use 'Choose File' instead.");
          setPhase("error");
        }
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {/* iOS sometimes throws an aborted-play promise; ignore */});
        }
        setPhase("live");
      } catch (e: unknown) {
        if (!mounted) return;
        const msg = (e as Error)?.message ?? "Camera access denied";
        setError(/permission/i.test(msg) || /denied/i.test(msg) ? "Camera permission denied. Allow camera access or use 'Choose File' instead." : msg);
        setPhase("error");
      }
    })();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function takePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPreviewDataUrl(dataUrl);
    setPhase("preview");
    // Stop the camera while we're previewing — saves battery on mobile and frees the camera
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function retake() {
    setPreviewDataUrl(null);
    setPhase("requesting");
    setError(null);
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setPhase("live");
      } catch (e: unknown) {
        setError((e as Error)?.message ?? "Camera unavailable");
        setPhase("error");
      }
    }
  }

  async function uploadCaptured() {
    if (!previewDataUrl) return;
    setPhase("uploading");
    try {
      const blob = await (await fetch(previewDataUrl)).blob();
      const name = filename ?? `capture-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
      const file = new File([blob], name, { type: "image/jpeg" });
      await onCapture(file);
      onClose();
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Upload failed");
      setPhase("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 bg-slate-900 flex items-center justify-center min-h-[280px]">
          {phase === "requesting" && (
            <p className="text-white text-sm">Requesting camera…</p>
          )}
          {phase === "live" && (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-auto max-h-[60vh] object-contain"
            />
          )}
          {phase === "preview" && previewDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewDataUrl} alt="Captured" className="w-full h-auto max-h-[60vh] object-contain" />
          )}
          {phase === "uploading" && (
            <p className="text-white text-sm">Uploading…</p>
          )}
          {phase === "error" && (
            <div className="px-6 text-center">
              <p className="text-red-300 text-sm">{error ?? "Camera unavailable"}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-center gap-3">
          {phase === "live" && (
            <button
              type="button"
              onClick={takePhoto}
              className="px-6 py-2 rounded-full bg-[#00929C] text-white font-semibold text-sm hover:bg-[#007279]"
            >
              Take Photo
            </button>
          )}
          {phase === "preview" && (
            <>
              <button
                type="button"
                onClick={retake}
                className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={uploadCaptured}
                className="px-6 py-2 rounded-full bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700"
              >
                Use Photo
              </button>
            </>
          )}
          {phase === "error" && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
