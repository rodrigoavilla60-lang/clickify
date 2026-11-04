import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-8 flex justify-center">
          <Logo size="lg" />
        </p>
        {children}
      </div>
    </main>
  );
}
