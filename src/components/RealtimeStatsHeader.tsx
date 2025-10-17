import { memo } from "react";
import { ExchangeSummary, PricePoint } from "../types";
import { formatCurrency, formatPercent, formatNumber } from "../utils/format";
import { Signal, WifiOff } from "lucide-react";

interface Props {
  exchanges: ExchangeSummary[];
  priceHistory: PricePoint[];
  isLoading: boolean;
}

function RealtimeStatsHeader({ exchanges, priceHistory, isLoading }: Props) {
  const latestPrice = priceHistory[priceHistory.length - 1];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {exchanges.map((exchange) => {
        const price = latestPrice?.values[exchange.id] ?? exchange.lastPrice;
        const priceChange = exchange.change24h;
        const latencyStatus =
          exchange.status === "online"
            ? "text-emerald-400"
            : exchange.status === "degraded"
              ? "text-amber-400"
              : "text-red-400";

        return (
          <article
            key={exchange.id}
            className="card relative overflow-hidden border border-slate-800/80 bg-slate-900/70"
          >
            <header className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  {exchange.name}
                </p>
                <p className="text-lg font-semibold text-white">
                  {isLoading ? "--" : formatCurrency(price, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <span className={`text-xs font-medium ${priceChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {isLoading ? "--" : formatPercent(priceChange)}
              </span>
            </header>
            <footer className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                {exchange.status === "offline" ? (
                  <WifiOff className="h-3.5 w-3.5" />
                ) : (
                  <Signal className="h-3.5 w-3.5" />
                )}
                <span className={latencyStatus}>{exchange.status.toUpperCase()}</span>
              </span>
              <span>成交量 {formatNumber(exchange.volume24h)}</span>
              <span>延遲 {Math.round(exchange.latency)}ms</span>
            </footer>
          </article>
        );
      })}
    </section>
  );
}

export default memo(RealtimeStatsHeader);
