"use client";

import { useState } from "react";
import { startGoogleSignIn } from "@/lib/api";
import { useProviders } from "@/hooks/useProviders";

/**
 * Renders the Google button only when the backend says Google is configured —
 * and says so out loud when the backend can't be reached at all, rather than
 * quietly rendering nothing and leaving you to guess which of the two it was.
 */
export default function GoogleButton({
  label = "Continue with Google",
}: {
  label?: string;
}) {
  const { providers, unreachable, loading } = useProviders();
  const [busy, setBusy] = useState(false);

  if (loading) {
    // Reserve the row so the form doesn't jump when the answer arrives.
    return <div className="h-[46px]" aria-hidden="true" />;
  }

  if (unreachable) {
    return (
      <p
        role="status"
        className="rounded-lg px-3.5 py-2.5 text-[12.5px] text-warn"
        style={{
          background: "color-mix(in oklab, var(--warn) 10%, transparent)",
          boxShadow: "0 0 0 1px color-mix(in oklab, var(--warn) 30%, transparent)",
        }}
      >
        Can&apos;t reach the server, so sign-in options are unavailable. Is the
        backend running on port 5050?
      </p>
    );
  }

  if (!providers?.google) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setBusy(true);
          startGoogleSignIn();
        }}
        disabled={busy}
        className="btn btn-secondary w-full"
      >
        <GoogleMark />
        {busy ? "Redirecting…" : label}
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11.5px] tracking-wide text-faint uppercase">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5a11 11 0 0 0-9.82 6.55l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z" />
    </svg>
  );
}
