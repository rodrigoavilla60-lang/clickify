import { Cable, Radio } from "lucide-react";
import { siGoogleads, siMeta, siShopify, siTiktok } from "simple-icons";

// Logos das plataformas. Os que existem no Simple Icons (CC0) vão desenhados; os outros viram um
// selo com a inicial na cor da marca, até termos o arquivo oficial de cada uma.
// Usados só para dizer com o que o Clickify conecta, nunca como marca do Clickify.

type Icon = { path: string; hex: string };

const ICONS: Record<string, Icon> = {
  meta: siMeta, google: siGoogleads, tiktok: { ...siTiktok, hex: "111111" }, shopify: siShopify,
};

const BADGES: Record<string, { letter: string; bg: string }> = {
  kwai: { letter: "K", bg: "#FF7A00" },
  taboola: { letter: "T", bg: "#1F5CB3" },
  hotmart: { letter: "H", bg: "#EF4D23" },
  kiwify: { letter: "K", bg: "#16A34A" },
  yampi: { letter: "Y", bg: "#D61F69" },
  eduzz: { letter: "E", bg: "#F28C00" },
  cartpanda: { letter: "C", bg: "#6D28D9" },
};

// Redesenhadas em SVG a partir das logos enviadas (troca pelo arquivo oficial quando houver).
const CUSTOM: Record<string, (s: number) => React.ReactNode> = {
  hotmart: (s) => (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg" style={{ width: s, height: s, background: "#F2501F" }}>
      <svg viewBox="0 0 24 24" style={{ width: s * 0.62, height: s * 0.62 }}>
        <path fill="#fff" fillRule="evenodd"
          d="M12.6 2.2c.4 2.3-.6 3.7-1.8 5-.9.9-1.6 1.7-1.6 3 0 .3 0 .6.1.8-1.3-.6-2-1.8-2-3.2C5 9.4 4 11.6 4 14a8 8 0 0 0 16 0c0-3.6-2.1-6.1-4-8.1.1 1.3-.4 2.4-1.4 3.1.2-2.9-.6-5.2-2-6.8ZM12 11a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
      </svg>
    </span>
  ),
  kiwify: (s) => (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white" style={{ width: s, height: s }}>
      <svg viewBox="0 0 24 24" style={{ width: s * 0.66, height: s * 0.66 }} fill="none">
        <path d="M17.2 6.8A7.4 7.4 0 1 0 19.4 12" stroke="#22B35E" strokeWidth="3.2" strokeLinecap="round" />
        {[[12, 7.6], [9.2, 9], [8.3, 12], [9.2, 15], [12, 16.4]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.95" fill="#22B35E" />
        ))}
      </svg>
    </span>
  ),
};

export function PlatformLogo({ id, size = 36 }: { id: string; size?: number }) {
  const box = { width: size, height: size };
  if (CUSTOM[id]) return CUSTOM[id](size);
  const icon = ICONS[id];
  if (icon)
    return (
      <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg" style={{ ...box, background: `#${icon.hex}` }}>
        <svg viewBox="0 0 24 24" fill="#fff" style={{ width: size * 0.56, height: size * 0.56 }}><path d={icon.path} /></svg>
      </span>
    );
  const b = BADGES[id];
  if (b)
    return (
      <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white" style={{ ...box, background: b.bg, fontSize: size * 0.45 }}>
        {b.letter}
      </span>
    );
  // Webhook genérico e modo "capturar"
  const Fallback = id === "capture" ? Radio : Cable;
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg bg-surface-2 text-brand-green" style={box}>
      <Fallback style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}
