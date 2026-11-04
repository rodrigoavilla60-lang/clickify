import Link from "next/link";
import { Card } from "@/components/ui";
import { ForgotForm } from "../password-forms";

export const metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenha() {
  return (
    <Card>
      <h1 className="mb-1 text-lg font-semibold">Esqueci minha senha</h1>
      <p className="mb-6 text-sm text-muted">Digite o e-mail da sua conta. Mandamos um link para você criar uma senha nova.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-muted">
        Lembrou? <Link href="/login" className="text-accent underline">Voltar para entrar</Link>
      </p>
    </Card>
  );
}
