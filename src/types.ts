export type ExchangeId = "binance" | "okx" | "bybit" | "bitfinex" | "kraken" | string;

export interface ExchangeSummary {
  id: ExchangeId;
  name: string;
  icon?: string;
  lastPrice: number;
  change24h: number;
  volume24h: number;
  status: "online" | "degraded" | "offline";
  latency: number;
}

export interface PricePoint {
  timestamp: number;
  dominantExchange: ExchangeId;
  values: Record<ExchangeId, number>;
}

export interface VolumePoint {
  timestamp: number;
  values: Record<ExchangeId, number>;
}

export interface DepthEntry {
  price: number;
  size: number;
}

export interface DepthSnapshot {
  exchange: ExchangeId;
  bids: DepthEntry[];
  asks: DepthEntry[];
  timestamp: number;
}

export interface WhaleAlert {
  id: string;
  exchange: ExchangeId;
  side: "buy" | "sell";
  amount: number;
  price: number;
  walletAddress: string;
  txHash: string;
  timestamp: number;
  note?: string;
}

export interface WalletProfile {
  address: string;
  label?: string;
  tags?: string[];
  totalValueUsd: number;
  lastActive: number;
  pnl7d: number;
  positions: Array<{
    symbol: string;
    size: number;
    entryPrice: number;
    pnl: number;
  }>;
  recentTransactions: Array<{
    id: string;
    symbol: string;
    side: "buy" | "sell";
    amount: number;
    price: number;
    timestamp: number;
    exchange: ExchangeId;
    txHash: string;
  }>;
}

export interface WalletWatchItem {
  address: string;
  alias?: string;
  createdAt: number;
}

export interface WalletSearchResult {
  address: string;
  label?: string;
  totalValueUsd: number;
  pnl7d: number;
  tags?: string[];
}

export interface LatencyMetrics {
  wsLatency: number;
  apiLatency: number;
  averageSpread: number;
}
