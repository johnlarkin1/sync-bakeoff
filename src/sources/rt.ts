import { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { API } from "../types";

// /rt invalidation: any bid event marks every bids query stale, as the RFC's event router would.
export function useRtInvalidation(qc: QueryClient) {
  useEffect(() => {
    const ws = new WebSocket(API.replace("http", "ws") + "/rt");
    ws.onmessage = (m) => {
      if (JSON.parse(m.data).type.startsWith("bid.")) qc.invalidateQueries({ queryKey: ["bids"] });
    };
    return () => ws.close();
  }, [qc]);
}
