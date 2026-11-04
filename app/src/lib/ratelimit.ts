import "server-only";

// Janela fixa em memória. Basta para uma instância; com várias na Vercel, trocar por Upstash/Redis.
const g = globalThis as unknown as { __rl?: Map<string, { count: number; reset: number }> };
const hits = (g.__rl ??= new Map());

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  // Os testes e2e criam vários usuários do mesmo IP. Nunca vale em produção.
  if (process.env.E2E === "1" && process.env.NODE_ENV !== "production") return true;
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  h.count++;
  return h.count <= max;
}
