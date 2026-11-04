// Ícone da Clickify redesenhado em SVG a partir da logo (replica/brand/clickify-logo.webp):
// três pontos que convergem num só. O nome vai como texto para ler bem no tema escuro.
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 380" className={className} aria-hidden focusable="false">
      <g fill="none" strokeLinecap="round" strokeWidth="34">
        <path className="stroke-brand-mint" d="M60 58 C170 58 190 92 240 142 S320 193 385 193" />
        <path className="stroke-brand-mint" d="M60 322 C170 322 190 288 240 238 S320 193 385 193" />
        <path className="stroke-brand-green" d="M60 190 H385" />
      </g>
      <circle className="fill-brand-mint" cx="60" cy="58" r="52" />
      <circle className="fill-brand-mint" cx="60" cy="322" r="52" />
      <circle className="fill-brand-green" cx="60" cy="190" r="52" />
      <circle className="fill-brand-green" cx="385" cy="190" r="62" />
    </svg>
  );
}

const SIZES = {
  md: { text: "text-base", mark: "h-5 w-6" },
  lg: { text: "text-2xl", mark: "h-7 w-8" },
  // Barra de cima: maior no computador, sem apertar o celular.
  xl: { text: "text-xl md:text-[26px]", mark: "h-6 w-7 md:h-8 md:w-10" },
};

export function Logo({ size = "md" }: { size?: keyof typeof SIZES }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${SIZES[size].text}`}>
      <LogoMark className={SIZES[size].mark} />
      Clickify
    </span>
  );
}
