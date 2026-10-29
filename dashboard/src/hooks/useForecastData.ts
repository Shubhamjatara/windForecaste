import { useCallback, useEffect, useRef, useState } from "react";
import { loadAnalysis } from "@/services/forecastService";
import type {
  DataStatus,
  DecisionSettings,
  ForecastAnalysis,
} from "@/types/forecast";

interface RequestState {
  key: string;
  status: DataStatus;
  analysis: ForecastAnalysis | null;
  error: string;
}
export function useForecastData(settings: DecisionSettings) {
  const key = JSON.stringify(settings);
  const [state, setState] = useState<RequestState>({
    key,
    status: "loading",
    analysis: null,
    error: "",
  });
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(
    async (force = true) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setState({ key, status: "loading", analysis: null, error: "" });
      try {
        const analysis = await loadAnalysis(settings, controller.signal, force);
        if (controller.signal.aborted) return;
        setState({ key, status: "success", analysis, error: "" });
      } catch (cause) {
        if (controller.signal.aborted) return;
        setState({
          key,
          status: "error",
          analysis: null,
          error:
            cause instanceof Error
              ? cause.message
              : "Unable to load forecast data. Please retry.",
        });
      }
    },
    [key, settings],
  );
  useEffect(() => {
    void refresh(false);
    return () => request.current?.abort();
  }, [refresh]);
  // Never render results belonging to a different decision cutoff.
  const current =
    state.key === key
      ? state
      : { status: "loading" as const, analysis: null, error: "" };
  return { ...current, refresh };
}
