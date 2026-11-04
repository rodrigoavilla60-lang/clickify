// Funil em forma de circuito: cada etapa tem um número de trilhas proporcional a quantas pessoas
// chegaram até ela. As trilhas de fora terminam primeiro (dobram em 45° e acabam num ponto: quem
// desistiu); as de dentro seguem até a venda. Função pura, testada em tests/circuit.test.ts.
// Coordenadas: cada coluna tem COL de largura, a altura total é H.

export const COL = 100;
export const H = 100;
export const MAX_TRACES = 12;

export interface Trace {
  y: number;
  d: string; // caminho SVG
  end: { x: number; y: number };
  reachesEnd: boolean; // chegou até a última etapa
  lastCol: number;
}

// Raiz quadrada: com proporção direta, 4% dos cliques virariam meia trilha e o desenho sumiria
// logo na 3ª etapa. Quem tem alguém sempre fica com pelo menos 1 trilha. Nunca aumenta de uma
// etapa para a outra (o desenho é de quem segue, não de quem chega de outro lugar).
export function traceCounts(fractions: (number | null)[], max = MAX_TRACES): number[] {
  const out: number[] = [];
  for (const f of fractions) {
    const raw = !f ? 0 : Math.max(1, Math.round(max * Math.sqrt(Math.min(1, f))));
    out.push(out.length ? Math.min(raw, out[out.length - 1]) : raw);
  }
  return out;
}

export function circuit(fractions: (number | null)[], max = MAX_TRACES): Trace[] {
  const counts = traceCounts(fractions, max);
  const n = counts.length;
  const mid = H / 2;
  const spacing = (H * 0.8) / (max - 1);
  // Ordem de sobrevivência: do centro para fora.
  const order = Array.from({ length: max }, (_, k) => k).sort((a, b) => Math.abs(a - (max - 1) / 2) - Math.abs(b - (max - 1) / 2));
  const traces: Trace[] = [];
  order.forEach((k, rank) => {
    if (rank >= counts[0]) return;
    const y = mid + (k - (max - 1) / 2) * spacing;
    let lastCol = 0;
    while (lastCol + 1 < n && rank < counts[lastCol + 1]) lastCol++;
    const reachesEnd = lastCol === n - 1;
    let d: string;
    let end: { x: number; y: number };
    if (reachesEnd) {
      end = { x: n * COL - 6, y };
      d = `M0,${y} H${end.x}`;
    } else {
      // Segue um pouco dentro da próxima coluna, dobra em 45° na direção do centro e acaba.
      const turnX = (lastCol + 1) * COL + 14;
      const dy = Math.sign(mid - y) * Math.min(10, Math.abs(mid - y));
      end = { x: turnX + Math.abs(dy) + 4, y: y + dy };
      d = `M0,${y} H${turnX} L${turnX + Math.abs(dy)},${y + dy} H${end.x}`;
    }
    traces.push({ y, d, end, reachesEnd, lastCol });
  });
  return traces.sort((a, b) => a.y - b.y);
}
