import Link from "next/link";
import { Card } from "@/components/ui";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <Card>
      <h1 className="mb-1 text-lg font-semibold">Criar conta</h1>
      <p className="mb-6 text-sm text-muted">Em três passos você vê qual anúncio paga a conta.</p>
      <AuthForm mode="register" />
      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta? <Link href="/login" className="text-accent underline">Entrar</Link>
      </p>
    </Card>
  );
}
