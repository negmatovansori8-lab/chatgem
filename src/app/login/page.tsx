import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-white/50">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
