import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Activity, TrendingUp, Wallet, ExternalLink } from "lucide-react";
import { fetcher } from "../api/client";
import { WalletProfile } from "../types";
import { compactAddress, formatCurrency, formatNumber, timeAgo } from "../utils/format";
import useWalletWatchlist from "../hooks/useWalletWatchlist";

export default function WalletDetailPage() {
  const { address = "" } = useParams<{ address: string }>();
  const { addToWatchlist, watchlist, removeFromWatchlist } = useWalletWatchlist();

  const { data, isLoading } = useQuery({
    queryKey: ["wallet", address],
    queryFn: () => fetcher<WalletProfile>(`/wallets/${address}`),
    enabled: Boolean(address)
  });

  const isWatched = useMemo(
    () => watchlist.some((item) => item.address === address),
    [address, watchlist]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:py-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400">
            <ArrowLeft className="h-4 w-4" /> 返回儀表板
          </Link>
          <button
            type="button"
            onClick={() =>
              isWatched
                ? removeFromWatchlist(address)
                : addToWatchlist({ address, createdAt: Date.now() })
            }
            className="rounded-full border border-slate-800 px-3 py-1 text-xs text-primary-300 hover:border-primary-500 hover:text-primary-200"
          >
            {isWatched ? "移除關注" : "加入關注"}
          </button>
        </div>

        <section className="card">
          <header className="flex flex-col gap-2 border-b border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-semibold text-white">
                <Wallet className="h-6 w-6 text-primary-300" />
                {compactAddress(address)}
              </h1>
              {data?.label && <p className="text-sm text-slate-400">{data.label}</p>}
            </div>
            {data && (
              <dl className="grid grid-cols-2 gap-4 text-sm text-slate-300 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-slate-500">資產淨值</dt>
                  <dd className="text-base text-white">{formatCurrency(data.totalValueUsd)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">7 天損益</dt>
                  <dd
                    className={`text-base ${data.pnl7d >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {formatCurrency(data.pnl7d)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">最後活動</dt>
                  <dd className="text-base text-white">{timeAgo(data.lastActive)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">標籤</dt>
                  <dd className="text-base text-white">{data.tags?.join(", ") ?? "-"}</dd>
                </div>
              </dl>
            )}
          </header>

          <div className="grid gap-6 py-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Activity className="h-5 w-5 text-primary-300" /> 最近大額交易
              </h2>
              <div className="mt-4 space-y-3">
                {isLoading && <p className="text-sm text-slate-400">載入中…</p>}
                {!isLoading && data?.recentTransactions.length === 0 && (
                  <p className="text-sm text-slate-500">尚無交易紀錄</p>
                )}
                {data?.recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-800/80 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm text-white">
                        {tx.symbol} · {tx.side === "buy" ? "買入" : "賣出"} {formatNumber(tx.amount)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(tx.price)} · {tx.exchange.toUpperCase()} · {timeAgo(tx.timestamp)}
                      </p>
                    </div>
                    <a
                      href={`https://explorer.xyz/tx/${tx.txHash}`}
                      className="inline-flex items-center gap-1 text-xs text-primary-300 hover:text-primary-100"
                      target="_blank"
                      rel="noreferrer"
                    >
                      查看鏈上紀錄 <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <section>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <TrendingUp className="h-5 w-5 text-primary-300" /> 倉位概覽
                </h2>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  {data?.positions.map((position) => (
                    <li
                      key={position.symbol}
                      className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3"
                    >
                      <div className="flex items-center justify-between text-white">
                        <span>{position.symbol}</span>
                        <span>{formatNumber(position.size)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                        <span>均價：{formatCurrency(position.entryPrice)}</span>
                        <span
                          className={position.pnl >= 0 ? "text-emerald-400" : "text-red-400"}
                        >
                          PnL：{formatCurrency(position.pnl)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {data && data.tags && data.tags.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-white">標籤</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-primary-500/50 px-3 py-1 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
