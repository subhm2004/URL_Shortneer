"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";

/**
 * The landing spot after Google sends the browser back.
 *
 * The backend puts our JWT in the URL **fragment** (`#token=…`), not the query
 * string — a fragment is never transmitted to any server, so it stays out of
 * access logs, proxy logs, and the Referer header of whatever the user clicks
 * next. It does land in browser history, which is why the first thing this page
 * does after reading it is strip it with history.replaceState.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;

    const token = new URLSearchParams(hash).get("token");

    if (!token) {
      setError("No sign-in token came back from Google.");
      return;
    }

    login(token);

    // Get it out of the address bar and out of this history entry, so a Back
    // button press — or a shared screenshot — doesn't carry the token with it.
    window.history.replaceState(null, "", window.location.pathname);

    router.replace("/dashboard");
  }, [login, router]);

  return (
    <div className="grid min-h-[70dvh] place-items-center px-5">
      {error ? (
        <div className="card max-w-[420px] p-8 text-center">
          <h1 className="text-[18px] font-semibold">Sign-in didn&apos;t complete</h1>
          <p className="mt-2 text-[14px] text-muted">{error}</p>
          <button
            onClick={() => router.replace("/login")}
            className="btn btn-primary mt-6"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-fg" />
          <p className="mono text-[13px] text-muted">Signing you in…</p>
        </div>
      )}
    </div>
  );
}
