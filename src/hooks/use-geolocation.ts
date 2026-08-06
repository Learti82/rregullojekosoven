"use client";

import { useCallback, useState } from "react";
import { isInsideKosovo } from "@/lib/utils";

type GeolocationState = {
  coords: { lat: number; lng: number } | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
};

/**
 * Browser geolocation with Albanian error copy.
 *
 * Deliberately manual (`request()`), never on mount: asking for location
 * unprompted is a hostile pattern and browsers penalise it.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    accuracy: null,
    loading: false,
    error: null,
  });

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, error: "Shfletuesi juaj nuk e mbështet gjeolokacionin." }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!isInsideKosovo(latitude, longitude)) {
          setState({
            coords: null,
            accuracy: null,
            loading: false,
            error: "Vendndodhja juaj është jashtë Kosovës. Zgjidhni pikën manualisht në hartë.",
          });
          return;
        }
        setState({
          coords: { lat: latitude, lng: longitude },
          accuracy,
          loading: false,
          error: null,
        });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Leja për vendndodhjen u refuzua. Zgjidhni pikën manualisht në hartë.",
          2: "Vendndodhja nuk mund të përcaktohet. Provoni sërish.",
          3: "Koha për marrjen e vendndodhjes skadoi. Provoni sërish.",
        };
        setState({
          coords: null,
          accuracy: null,
          loading: false,
          error: messages[error.code] ?? "Gjeolokacioni dështoi.",
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, []);

  return { ...state, request };
}
