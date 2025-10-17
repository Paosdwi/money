import { useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Wallet, BellRing, Search } from "lucide-react";
import ExchangeComparisonChart from "./components/ExchangeComparisonChart";
import DepthComparisonChart from "./components/DepthComparisonChart";
import WhaleAlertList from "./components/WhaleAlertList";
import WalletSearchPanel from "./components/WalletSearchPanel";
import RealtimeStatsHeader from "./components/RealtimeStatsHeader";
import useExchangeData from "./hooks/useExchangeData";
import useWhaleAlerts from "./hooks/useWhaleAlerts";
import useWalletWatchlist from "./hooks/useWalletWatchlist";

function App() {
  const {
    exchanges,
    priceHistory,
    depthSnapshots,
    volumeHistory,
    isLoading: isExchangeLoading,
    latencyMetrics
  } = useExchangeData();

  const { whaleAlerts, isLoading: isAlertLoading } = useWhaleAlerts();
  const { watchlist } = useWalletWatchlist();

  const heroStats = useMemo(() => {
    const latest = priceHistory[priceHistory.length - 1];
    return {
      dominantExchange: latest?.dominantExchange ?? "-",
      averageSpread: latencyMetrics.averageSpread.toFixed(3),
      updateLatency: `${latencyMetrics.wsLatency} ms`
    };
  }, [priceHistory, latencyMetrics]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:py-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-white md:text-3xl">
              <TrendingUp className="h-6 w-6 text-primary-400" />
              Money Trading Intelligence
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              多交易所即時監控、深度視覺化、錢包追蹤與大戶告警儀表板。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-slate-800 px-3 py-1">
              WS 延遲：{heroStats.updateLatency}
            </span>
            <span className="rounded-full border border-slate-800 px-3 py-1">
              平均價差：{heroStats.averageSpread}
            </span>
            <span className="rounded-full border border-slate-800 px-3 py-1">
              領先交易所：{heroStats.dominantExchange}
            </span>
          </div>
        </header>

        <RealtimeStatsHeader
          exchanges={exchanges}
          priceHistory={priceHistory}
          isLoading={isExchangeLoading}
        />

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <article className="card lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <TrendingUp className="h-5 w-5 text-primary-300" />
                多交易所價格與成交量
              </h2>
            </div>
            <ExchangeComparisonChart
              priceHistory={priceHistory}
              volumeHistory={volumeHistory}
              isLoading={isExchangeLoading}
            />
          </article>
          <article className="card h-full">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <BellRing className="h-5 w-5 text-primary-300" />
              即時大戶告警
            </h2>
            <WhaleAlertList alerts={whaleAlerts} isLoading={isAlertLoading} />
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <article className="card lg:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Wallet className="h-5 w-5 text-primary-300" />
              買賣深度視覺化
            </h2>
            <DepthComparisonChart depthSnapshots={depthSnapshots} isLoading={isExchangeLoading} />
          </article>
          <article className="card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Search className="h-5 w-5 text-primary-300" />
                錢包搜尋與關注
              </h2>
              <Link
                to={watchlist[0] ? `/wallet/${watchlist[0].address}` : "#"}
                className="text-xs text-primary-300 hover:text-primary-200 disabled:cursor-not-allowed disabled:text-slate-500"
                aria-disabled={!watchlist[0]}
              >
                查看最新關注
              </Link>
            </div>
            <WalletSearchPanel />
          </article>
        </section>
      </div>
    </div>
  );
}

export default App;
