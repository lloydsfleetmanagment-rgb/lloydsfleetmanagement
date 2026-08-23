import { fmtNumber } from "@/lib/fleetiq";
import type { OperatorLog } from "@/lib/queries";

const NODES = [
  { code: "TH-1", label: "TH-1", x: 68, y: 24 },
  { code: "TH-2", label: "TH-2 (SANY)", x: 82, y: 40 },
  { code: "TH-3", label: "TH-3 (SANY)", x: 84, y: 62 },
  { code: "TH-4", label: "TH-4", x: 70, y: 78 },
  { code: "TH-5", label: "TH-5", x: 56, y: 88 },
  { code: "BHQ-TOP-DUMP", label: "BHQ Top", x: 20, y: 80 },
  { code: "Shale Dump Top", label: "Shale Top", x: 14, y: 26 },
  { code: "Shale Dump Bottom", label: "Shale Bottom", x: 28, y: 52 },
];

export function MineMap({ logs }: { logs: OperatorLog[] }) {
  const totals = new Map<string, number>();
  logs.forEach((l) => totals.set(l.destination_code, (totals.get(l.destination_code) ?? 0) + Number(l.quantity_t)));
  const max = Math.max(1, ...Array.from(totals.values()));

  return (
    <div
      className="relative mt-5 h-[340px] w-full overflow-hidden rounded-2xl border border-border"
      style={{
        background:
          "radial-gradient(680px 340px at 45% 40%, oklch(0.2875 0.0163 259.79), oklch(0.1624 0.0054 248.16))",
        boxShadow: "inset 0 2px 30px rgba(0,0,0,.6)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0 / .25) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / .25) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          transform: "perspective(700px) rotateX(46deg) scale(1.5)",
          transformOrigin: "center 70%",
        }}
      />

      <div
        className="absolute left-[36%] top-[38%] h-32 w-44 -translate-x-1/2 -translate-y-1/2 rounded-[40%] border border-primary/30"
        style={{
          background: "conic-gradient(from 200deg, oklch(0.4029 0.0367 251.7 / .8), oklch(0.2505 0.0128 258.37))",
          boxShadow: "0 18px 40px rgba(0,0,0,.55)",
          transform: "perspective(700px) rotateX(52deg)",
        }}
      >
        <span className="absolute inset-x-0 -top-6 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Active pit
        </span>
      </div>

      {NODES.map((n) => {
        const value = totals.get(n.code) ?? 0;
        const intensity = value / max;
        return (
          <div key={n.code} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
            <div
              className="rounded-xl border px-2.5 py-1.5 text-center backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
              style={{
                borderColor: value > 0 ? `oklch(0.778 0.1454 169.75 / ${0.3 + intensity * 0.6})` : "oklch(1 0 0 / .1)",
                background: "oklch(0.2505 0.0128 258.37 / .85)",
                boxShadow: value > 0 ? `0 0 ${8 + intensity * 22}px oklch(0.778 0.1454 169.75 / ${0.15 + intensity * 0.35})` : "none",
              }}
            >
              <p className="text-[10px] font-medium">{n.label}</p>
              <p className="font-mono text-[10px] tabular-nums text-primary">{fmtNumber(value)} t</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
