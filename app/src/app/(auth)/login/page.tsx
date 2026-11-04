import Link from "next/link";
import { Card } from "@/components/ui";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <Card>
      <h1 className="mb-1 text-lg font-semibold">Entrar</h1>
      <p className="mb-6 text-sm text-muted">Seus números de hoje estão te esperando.</p>
      <AuthForm mode="login" />
      <p className="mt-6 text-center text-sm text-muted">
        Ainda não tem conta? <Link href="/register" className="text-accent underline">Criar agora</Link>
      </p>
    </Card>
  );
}
