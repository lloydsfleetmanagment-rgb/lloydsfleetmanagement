const DOTS = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 61) % 100,
  size: 1 + (i % 3),
  delay: (i % 9) * 0.7,
  duration: 9 + (i % 7) * 1.6,
}));

/** Very light ambient particle field — purely decorative. */
export function Particles() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-60">
      {DOTS.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-primary/25"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            animation: `fq-drift ${d.duration}s ${d.delay}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}
