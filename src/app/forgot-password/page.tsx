"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(
      "Password reset email flow will connect to the auth service next. No fake confirmation sent.",
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-2xl font-bold text-[var(--fg)]">Forgot password</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Enter your email to request a secure reset link.
          </p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required />
          </div>
          {notice ? (
            <p className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--fg-muted)]" role="status">
              {notice}
            </p>
          ) : null}
          <Button className="w-full" type="submit">
            Request reset
          </Button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-semibold text-[var(--accent)]">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
