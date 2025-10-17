import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher, createWebSocket } from "../api/client";
import { WhaleAlert } from "../types";

interface WhaleAlertStreamMessage extends WhaleAlert {}

export default function useWhaleAlerts() {
  const { data: initialAlerts = [], isLoading: isInitialLoading } = useQuery({
    queryKey: ["whale-alerts"],
    queryFn: () => fetcher<WhaleAlert[]>("/alerts/whales"),
    staleTime: 30_000,
    initialData: []
  });

  const [whaleAlerts, setWhaleAlerts] = useState<WhaleAlert[]>(initialAlerts);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setWhaleAlerts(initialAlerts);
  }, [initialAlerts]);

  useEffect(() => {
    const unsubscribe = createWebSocket<WhaleAlertStreamMessage>(
      {
        topic: "whale-alerts",
        reconnect: true
      },
      (payload) => {
        setWhaleAlerts((prev) => [payload, ...prev].slice(0, 50));
      },
      (status) => {
        setConnected(status === "connected");
      }
    );

    return unsubscribe;
  }, []);

  return {
    whaleAlerts,
    isLoading: isInitialLoading && !connected
  };
}
