import { useEffect, useState } from "react";

/**
 * Branded launch splash shown only when the app is opened from an installed
 * icon (standalone / home-screen). Fades out once the shell is ready.
 */
export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari home-screen flag
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    setVisible(true);
    const fadeTimer = window.setTimeout(() => setFading(true), 900);
    const hideTimer = window.setTimeout(() => setVisible(false), 1400);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,hsl(var(--primary)/0.18),transparent_65%)]" />
      <img
        src="/icon-512.png"
        alt=""
        width={112}
        height={112}
        className="relative h-28 w-28 animate-pulse rounded-3xl shadow-2xl"
      />
      <div className="relative text-center">
        <p className="text-xl font-semibold tracking-[0.2em] text-foreground">LLOYDS FLEETIQ</p>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Surjagarh Iron Ore Mine
        </p>
      </div>
    </div>
  );
}
