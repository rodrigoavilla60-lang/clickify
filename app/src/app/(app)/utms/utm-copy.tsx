"use client";

import { CopyField } from "@/components/client";
import { markUtmsCopied } from "../actions";

export function UtmCopy({ value }: { value: string }) {
  return <CopyField value={value} label="Parâmetros de URL para o anúncio" onCopy={() => void markUtmsCopied()} />;
}
