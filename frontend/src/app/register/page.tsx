"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, register as registerRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthProvider";
import GoogleButton from "@/components/GoogleButton";

const MIN_PASSWORD = 8;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Checked here as well as on the server. Not for security — the server is the
  // only thing that can enforce this — but so the user finds out before a
  // round-trip.
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || tooShort) return;

    setBusy(true);
    setError("");

    try {
      // The backend returns a JWT on register, so a new user is signed in
      // immediately rather than being bounced to a login form.
      const { token } = await registerRequest({ name, email, password });
      login(token);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create the account.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-5 py-16">
      <div className="grid-bg" aria-hidden="true" />

      <div className="card-raised relative w-full max-w-[440px] p-9">
        <h1 className="display text-[26px] text-fg">Create an account</h1>
        <p className="mt-2 text-[14px] text-muted">
          Free. Your links start tracking clicks straight away.
        </p>

        <div className="mt-8 flex flex-col gap-5">
          <GoogleButton label="Sign up with Google" />
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
          <div>
            <label htmlFor="name" className="label">Name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              className={`input ${tooShort ? "input-error" : ""}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
            />
            <p
              id="password-hint"
              className={`mt-2 text-[12px] ${tooShort ? "text-danger" : "text-faint"}`}
            >
              At least {MIN_PASSWORD} characters.
            </p>
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

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={busy || tooShort}
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-7 text-center text-[13.5px] text-muted">
          Already have one?{" "}
          <Link href="/login" className="text-fg underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
