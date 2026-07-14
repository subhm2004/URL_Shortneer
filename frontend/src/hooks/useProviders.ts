"use client";

import { useEffect, useState } from "react";
import { ApiError, providers, type Providers } from "@/lib/api";

interface State {
  providers: Providers | null;
  /** The backend didn't answer at all. Different from "Google isn't configured". */
  unreachable: boolean;
  loading: boolean;
}

/**
 * Asks the backend which sign-in methods exist.
 *
 * `unreachable` is kept apart from `providers.google === false` on purpose. They
 * produce the same visible result — no Google button — but they mean completely
 * different things, and collapsing them into one is how you spend an evening
 * wondering why a button won't appear when the real answer is that the server
 * isn't running.
 */
export function useProviders(): State {
  const [state, setState] = useState<State>({
    providers: null,
    unreachable: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    providers()
      .then((p) => {
        if (!cancelled) setState({ providers: p, unreachable: false, loading: false });
      })
      .catch((err) => {
        if (cancelled) return;
        // status 0 is our marker for "fetch never got a response".
        const unreachable = err instanceof ApiError && err.status === 0;
        setState({ providers: null, unreachable, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
