import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher, createWebSocket } from "../api/client";
import {
  DepthSnapshot,
  ExchangeSummary,
  LatencyMetrics,
  PricePoint,
  VolumePoint
} from "../types";

interface ExchangeStreamMessage {
  timestamp: number;
  dominantExchange: string;
  prices: Record<string, number>;
  volumes: Record<string, number>;
  depth: Array<{
    exchange: string;
    bids: Array<{ price: number; size: number }>;
    asks: Array<{ price: number; size: number }>;
  }>;
  latency: LatencyMetrics;
}

const FALLBACK_EXCHANGES: ExchangeSummary[] = [
  {
    id: "binance",
    name: "Binance",
    lastPrice: 0,
    change24h: 0,
    volume24h: 0,
    status: "degraded",
    latency: 0
  },
  {
    id: "okx",
    name: "OKX",
    lastPrice: 0,
    change24h: 0,
    volume24h: 0,
    status: "degraded",
    latency: 0
  },
  {
    id: "bybit",
    name: "Bybit",
    lastPrice: 0,
    change24h: 0,
    volume24h: 0,
    status: "degraded",
    latency: 0
  }
];

const FALLBACK_LATENCY: LatencyMetrics = {
  apiLatency: 0,
  wsLatency: 0,
  averageSpread: 0
};

export default function useExchangeData() {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [volumeHistory, setVolumeHistory] = useState<VolumePoint[]>([]);
  const [depthSnapshots, setDepthSnapshots] = useState<DepthSnapshot[]>([]);
  const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics>(FALLBACK_LATENCY);

  const { data: exchanges = FALLBACK_EXCHANGES, isLoading } = useQuery({
    queryKey: ["exchanges"],
    queryFn: () => fetcher<ExchangeSummary[]>("/exchanges"),
    placeholderData: FALLBACK_EXCHANGES
  });

  useEffect(() => {
    const unsubscribe = createWebSocket<ExchangeStreamMessage>(
      {
        topic: "market",
        payload: { symbol: "BTCUSDT" },
        reconnect: true
      },
      (payload) => {
        const point: PricePoint = {
          timestamp: payload.timestamp,
          dominantExchange: payload.dominantExchange,
          values: payload.prices
        };
        const volumePoint: VolumePoint = {
          timestamp: payload.timestamp,
          values: payload.volumes
        };

        setPriceHistory((prev) =>
          [...prev.slice(-299), point].sort((a, b) => a.timestamp - b.timestamp)
        );
        setVolumeHistory((prev) =>
          [...prev.slice(-299), volumePoint].sort((a, b) => a.timestamp - b.timestamp)
        );
        setDepthSnapshots(payload.depth.map((depth) => ({
          exchange: depth.exchange,
          bids: depth.bids,
          asks: depth.asks,
          timestamp: payload.timestamp
        })));
        setLatencyMetrics(payload.latency);
      },
      () => {}
    );

    return unsubscribe;
  }, []);

  const mergedExchanges = useMemo(() => {
    if (!exchanges?.length) {
      return FALLBACK_EXCHANGES;
    }
    const latestPrice = priceHistory[priceHistory.length - 1];
    if (!latestPrice) return exchanges;

    return exchanges.map((exchange) => ({
      ...exchange,
      lastPrice: latestPrice.values[exchange.id] ?? exchange.lastPrice
    }));
  }, [exchanges, priceHistory]);

  return {
    exchanges: mergedExchanges,
    priceHistory,
    volumeHistory,
    depthSnapshots,
    isLoading,
    latencyMetrics
  };
}
