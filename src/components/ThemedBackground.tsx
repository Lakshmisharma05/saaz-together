import { useEffect, useState } from "react";

/**
 * Renders a fixed full-screen gradient background derived from the dominant colors
 * of the currently playing track's thumbnail. Fades smoothly between tracks.
 */
export function ThemedBackground({ thumbnail }: { thumbnail?: string | null }) {
  const [colors, setColors] = useState<[string, string, string] | null>(null);

  useEffect(() => {
    if (!thumbnail) {
      setColors(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.src = thumbnail;
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 48;
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 200) continue;
          // Skip near-grey / near-black / near-white pixels so the theme has personality
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat < 0.18) continue;
          if (max < 30 || min > 235) continue;
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const cur = buckets.get(key);
          if (cur) {
            cur.r += r;
            cur.g += g;
            cur.b += b;
            cur.count += 1;
          } else {
            buckets.set(key, { r, g, b, count: 1 });
          }
        }
        const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
        const pick = (idx: number) => {
          const b = sorted[idx] ?? sorted[0];
          if (!b) return "#1a1a2e";
          const r = Math.round(b.r / b.count);
          const g = Math.round(b.g / b.count);
          const bl = Math.round(b.b / b.count);
          return `rgb(${r}, ${g}, ${bl})`;
        };
        if (sorted.length === 0) {
          setColors(null);
          return;
        }
        setColors([pick(0), pick(1), pick(2)]);
      } catch {
        setColors(null);
      }
    };
    img.onerror = () => setColors(null);
    return () => {
      cancelled = true;
    };
  }, [thumbnail]);

  const bg = colors
    ? `radial-gradient(at 20% 15%, ${colors[0]} 0%, transparent 55%), radial-gradient(at 85% 25%, ${colors[1]} 0%, transparent 50%), radial-gradient(at 50% 90%, ${colors[2]} 0%, transparent 60%)`
    : undefined;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 transition-opacity duration-[1500ms]"
      style={{ opacity: colors ? 0.55 : 0 }}
    >
      <div className="absolute inset-0" style={{ backgroundImage: bg }} />
      {/* Soft dark veil so foreground stays readable */}
      <div className="absolute inset-0 bg-background/55 backdrop-blur-3xl" />
    </div>
  );
}
