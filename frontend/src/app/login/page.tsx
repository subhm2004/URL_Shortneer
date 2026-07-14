"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, login as loginRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const { token } = await loginRequest({ email, password });
      login(token);
      router.push("/dashboard");
    } catch (err) {
      // The backend deliberately returns one identical message for "no such user"
      // and "wrong password" — telling them apart would let someone enumerate
      // which emails have accounts. Show it as-is.
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-5 py-16">
      <div className="grid-bg" aria-hidden="true" />

      <div className="card-raised relative w-full max-w-[420px] p-9">
        <h1 className="display text-[26px] text-fg">Welcome back</h1>
        <p className="mt-2 text-[14px] text-muted">
          Sign in to see your links and their clicks.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg px-3.5 py-2.5 text-[13px] text-danger"
              style={{
                background: "color-mix(in oklab, var(--danger) 10%, transparent)",
                boxShadow: "0 0 0 1px color-mix(in oklab, var(--danger) 35%, transparent)",
              }}
            >
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-7 text-center text-[13.5px] text-muted">
          No account?{" "}
          <Link href="/register" className="text-fg underline underline-offset-2">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
