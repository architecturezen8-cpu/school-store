"use client";

import { Spinner } from "@/components/Spinner";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, Camera, CheckCircle2, Keyboard, RotateCcw, XCircle } from "lucide-react";
import { errorMessage } from "@/lib/errors";

/**
 * The volunteer's screen at the gate.
 *
 * Scanning uses the phone's own camera through BarcodeDetector where the
 * browser supports it (Chrome/Edge on Android, and Chrome on desktop). Where it
 * does not — iOS Safari, Firefox — the box accepts the code by paste or a typed
 * reference, which is the fallback a staff member would use anyway if a QR is
 * creased.
 */

type ScanTicket = {
  token: string;
  reference: string;
  name: string;
  event: string;
  eventDate: string;
  venue: string;
  city: string;
  seats: number;
  tiers: string[];
  admittedAt: string | null;
  admittedBy: string;
  /** Which person this is, and how many the booking holds. */
  seq: number;
  of: number;
  /** This ticket's own code, e.g. `BM-BK7MQ-9WXT3`. */
  code: string;
  tierName: string;
};

type ScanResult =
  | { status: "admitted"; ticket: ScanTicket }
  | { status: "already"; ticket: ScanTicket }
  /** Stopped by the admin: this code exists, and must not open the door. */
  | { status: "blocked"; ticket: ScanTicket }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export default function GateScanner() {
  const [by, setBy] = useState("Gate");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "unsupported">("off");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const lastScan = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const submit = useCallback(
    async (scan: string) => {
      const value = scan.trim();
      if (!value || busy) return;
      setBusy(true);
      setResult(null);
      try {
        const res = await fetch("/api/gate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scan: value, by }),
        });
        const json = (await res.json()) as ScanResult & { error?: string };
        if (!res.ok) {
          setResult({ status: "error", message: json.error ?? `Request failed (${res.status})` });
        } else {
          setResult(json);
        }
        if (navigator.vibrate) {
          navigator.vibrate(json.status === "admitted" ? 120 : [60, 60, 60]);
        }
      } catch (err) {
        setResult({ status: "error", message: errorMessage(err) });
      } finally {
        setBusy(false);
        setText("");
      }
    },
    [busy, by]
  );

  const stopCamera = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera("off");
  }, []);

  const startCamera = useCallback(async () => {
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      setCamera("unsupported");
      return;
    }
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamera("on");

      const detector = new Ctor({ formats: ["qr_code"] });
      const tick = async () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue?.trim();
          const now = Date.now();
          // The camera sees the same code ~30 times a second; only act on a
          // change, or on the same code after two seconds.
          if (value && (value !== lastScan.current.value || now - lastScan.current.at > 2000)) {
            lastScan.current = { value, at: now };
            await submit(value);
          }
        } catch {
          /* a dropped frame is not worth reporting */
        }
        loopRef.current = requestAnimationFrame(tick);
      };
      loopRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setCamera("off");
      setResult({ status: "error", message: `Camera unavailable: ${errorMessage(err)}` });
    }
  }, [submit]);

  useEffect(() => stopCamera, [stopCamera]);

  // Admitted is the one tile that turns gold: it is the loudest fill the
  // palette has, and gold already means "this one is real" everywhere else.
  // Error keeps the bright surface, because a rejection has to stop someone.
  const tone =
    result?.status === "admitted"
      ? "bg-gold text-black"
      : result?.status === "blocked"
        ? "bg-panel-2 text-strong ring-1 ring-gold"
        : result?.status === "already"
          ? "bg-panel-2 text-strong"
        : result
          ? "bg-well text-strong"
          : "bg-well text-strong";

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">Gate</span>
        <input
          value={by}
          onChange={(e) => setBy(e.target.value)}
          className="mt-2 w-full rounded-xl bg-well px-4 py-3 text-strong outline-none transition-colors focus:bg-panel-2 focus:ring-2 focus:ring-gold"
          placeholder="Gate 1"
        />
      </label>

      <div className="relative overflow-hidden rounded-xl bg-page">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`aspect-[4/3] max-h-[420px] w-full object-cover ${camera === "on" ? "" : "hidden"}`}
        />
        {camera !== "on" && (
          <div className="grid aspect-[4/3] max-h-[420px] w-full place-items-center gap-3 p-6 text-center">
            <Camera className="h-10 w-10 text-faint" />
            {camera === "unsupported" ? (
              <p className="text-sm text-body">
                This browser cannot scan with the camera. Paste the ticket link
                below, or type the reference.
              </p>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                disabled={camera === "starting"}
                className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-60"
              >
                {camera === "starting" ? "Starting camera…" : "Start camera"}
              </button>
            )}
          </div>
        )}
      </div>

      {camera === "on" && (
        <button
          type="button"
          onClick={stopCamera}
          className="w-full rounded-xl bg-panel-2 px-4 py-3 text-sm text-strong hover:bg-panel-2"
        >
          Stop camera
        </button>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(text);
        }}
        className="space-y-2"
      >
        <label className="block">
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
            <Keyboard className="h-3.5 w-3.5" /> Paste the link, or type the code
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="the QR link, a ticket code (BM-…), or a booking reference"
            className="mt-2 w-full rounded-xl bg-well px-4 py-3 text-sm text-strong outline-none transition-colors focus:bg-panel-2 focus:ring-2 focus:ring-gold"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black hover:bg-gold-bright disabled:opacity-40"
        >
          {busy ? (
            <>
              <Spinner size={15} className="inline" /> Checking…
            </>
          ) : (
            "Check ticket"
          )}
        </button>
      </form>

      {result && (
        <div className={`rounded-xl p-5 ${tone}`}>
          <div className="flex items-center gap-2">
            {result.status === "admitted" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : result.status === "blocked" ? (
              <Ban className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <p className="font-display text-lg font-semibold">
              {result.status === "admitted"
                ? "Admitted"
                : result.status === "blocked"
                  ? "Blocked — do not admit"
                  : result.status === "already"
                    ? "Already admitted"
                    : result.status === "invalid"
                      ? "Invalid ticket"
                      : "Error"}
            </p>
          </div>

          {"ticket" in result && result.ticket ? (
            <div className="mt-3 space-y-1 text-sm text-current/70">
              <p className="text-base font-medium">{result.ticket.name}</p>
              <p className="opacity-60">{result.ticket.event}</p>
              <p className="opacity-60">
                {result.ticket.seats} seat{result.ticket.seats === 1 ? "" : "s"} on the
                booking
              </p>
              {/* The important line when a booking has several tickets: this is
                  one person, not the whole party. Saying "2 of 4" is what stops
                  a volunteer looking for four people on one code. */}
              {result.ticket.of > 1 && (
                <p className="font-semibold">
                  Ticket {result.ticket.seq} of {result.ticket.of} — admit one person
                </p>
              )}
              {/* The ticket's own code first: it names this one seat, which is
                  what the office needs when a code has to be stopped or the
                  person has to be written down in the incident book. */}
              {result.ticket.code && (
                <p className="font-mono text-xs opacity-70">{result.ticket.code}</p>
              )}
              <p className="font-mono text-xs opacity-60">Ref {result.ticket.reference}</p>
              {result.status === "already" && result.ticket.admittedAt && (
                <p className="mt-2 rounded-lg bg-page px-3 py-2 text-strong">
                  {result.ticket.of > 1 ? `Ticket ${result.ticket.seq} of ${result.ticket.of} was` : "First"} scanned{" "}
                  {new Date(result.ticket.admittedAt).toLocaleString("en-GB")}
                  {result.ticket.admittedBy ? ` at ${result.ticket.admittedBy}` : ""}. Do
                  not admit again — {result.ticket.of > 1 ? "the other people on this booking have their own codes." : "one scan, one entry."}
                </p>
              )}
              {result.status === "blocked" && (
                <p className="mt-2 rounded-lg bg-page px-3 py-2 text-strong">
                  The school has stopped this ticket. Turn the person away and send
                  them to the office — do not let them in on somebody else&apos;s code.
                </p>
              )}
              {result.status === "already" && (
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/gate", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ token: result.ticket!.token, reopen: true }),
                    }).catch(() => {});
                    setResult(null);
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-panel px-3 py-2 text-xs text-body hover:text-strong"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Undo (only if this was a mis-scan)
                </button>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm opacity-70">
              {"message" in result ? result.message : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
