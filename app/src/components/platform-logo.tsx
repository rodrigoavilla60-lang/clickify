import { Cable, Radio } from "lucide-react";
import { siGoogleads, siMeta, siShopify, siTiktok } from "simple-icons";

// Logos das plataformas. Simple Icons (CC0) quando existe; arquivo oficial da marca quando
// conseguimos (eduzz, cartpanda, yampi); o resto vira um selo com a inicial na cor da marca.
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
  eduzz: (s) => (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white" style={{ width: s, height: s }}>
      <svg viewBox="395 -8 290 293" style={{ width: s * 0.72, height: s * 0.72 }}>
        <path d="M642.65,46.16h-206.4c15.34-17.15,34.9-30.45,57.05-38.27,14.44-5.11,29.97-7.89,46.16-7.89s30.63,2.59,44.64,7.35c22.77,7.75,42.86,21.26,58.56,38.81h0Z" fill="#f9b122" />,
        <path d="M675.99,115.39h-273.09c1.32-7.94,3.33-15.65,5.96-23.07h55.18c10.37,0,20.67-1.3,30.65-3.85,8.53-2.18,16.83-5.27,24.75-9.23l9.24-4.62c8.42-4.21,17.26-7.43,26.34-9.62,9.49-2.29,19.24-3.46,29.06-3.46h70.48c14.02,20.89,19.35,41.51,21.41,53.85h.02Z" fill="#f9b122" />,
        <path d="M677.92,138.48c0,17.28-3.1,32.65-7.89,46.16h-261.16c-2.63-7.42-4.64-15.14-5.96-23.09h14.98c10.36,0,20.64-1.3,30.61-3.84,8.55-2.18,16.86-5.27,24.8-9.24l9.21-4.61c8.37-4.18,17.15-7.39,26.19-9.58,9.54-2.31,19.34-3.5,29.22-3.5h139.78c.15,2.55.22,5.11.22,7.7h0Z" fill="#f9b122" />,
        <path d="M663.52,200.01c-5.56,11.21-12.6,21.54-20.87,30.77-13.69,15.3-30.74,27.54-49.98,35.56-16.38,6.83-34.35,10.59-53.21,10.59-16.19,0-31.72-2.78-46.16-7.89-22.15-7.82-41.71-21.12-57.05-38.27h27.81c10.37,0,20.67-1.3,30.65-3.85,8.53-2.18,16.83-5.26,24.75-9.22l9.24-4.62c8.42-4.21,17.26-7.43,26.35-9.62,9.48-2.29,19.23-3.45,29.05-3.45h79.43-.01Z" fill="#f9b122" />
      </svg>
    </span>
  ),
  cartpanda: (s) => (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white" style={{ width: s, height: s }}>
      <svg viewBox="668.95 634.25 662.1 731.51" style={{ width: s * 0.72, height: s * 0.72 }}>
        <path d="M1331.05,965.27c0-6.28-0.19-12.5-0.54-18.69h0.46c-9.71-174.12-153.96-312.33-330.51-312.33   c-6.44,0-12.83,0.21-19.18,0.57v-0.06c-174.12,9.71-312.33,153.96-312.33,330.51c0,173.84,134,316.37,304.34,329.97   c4.32,0.34,7.99-3.13,7.99-7.47v-173.02c1.86-8.62,9.52-15.08,18.7-15.08c10.57,0,19.14,8.57,19.14,19.14l0.12,239.04   c0,6.63,7.67,10.31,12.84,6.16l66.35-53.27l104.4-83.82l0,0C1280.84,1166.36,1331.05,1071.68,1331.05,965.27z" fill="#111111" />,
        <path d="M981.28,1051.1L981.28,1051.1C981.28,1051.1,981.28,1051.1,981.28,1051.1c1.6,0.76,19.82,6.98,37.45,0l0,0   c7.47-3.55,15.16-7.68,15.16-18.2c0-8.7-8.17-17.58-33.88-17.58c-25.71,0-33.88,8.88-33.88,17.58   C966.12,1043.42,973.8,1047.55,981.28,1051.1z" fill="#111111" />,
        <path d="M1133.94,1017.52c7.5-11.64,12.71-25.1,12.71-40.01c0-38.26-31.02-69.28-69.28-69.28c-8.08,0-15.84,1.38-23.06,3.93    c0,0-26.6,10.53-31.08,37.59s19.22,32.26,34.06,36.7c14.84,4.44,29.28,17.48,34.94,25.74c5.66,8.26,10.72,15.05,21.88,15.05    S1130.64,1022.65,1133.94,1017.52z" fill="#111111" />,
        <path d="M866.06,1017.52c-7.5-11.64-12.71-25.1-12.71-40.01c0-38.26,31.02-69.28,69.28-69.28c8.08,0,15.84,1.38,23.06,3.93    c0,0,26.6,10.53,31.08,37.59c4.48,27.06-19.22,32.26-34.06,36.7c-14.84,4.44-29.28,17.48-34.94,25.74    c-5.66,8.26-10.72,15.05-21.88,15.05C874.71,1027.24,869.36,1022.65,866.06,1017.52z" fill="#111111" />
        <circle fill="#FFFFFF" cx="1000" cy="918.28" r="210.26"/>
      </svg>
    </span>
  ),
  yampi: (s) => (
    <img aria-hidden src="/logos/yampi-icon.png" alt="" width={s} height={s} className="shrink-0 rounded-lg" style={{ width: s, height: s }} />
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
