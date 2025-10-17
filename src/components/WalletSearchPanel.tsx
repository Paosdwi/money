import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Star, StarOff } from "lucide-react";
import { fetcher } from "../api/client";
import { WalletSearchResult } from "../types";
import useDebounce from "../hooks/useDebounce";
import useWalletWatchlist from "../hooks/useWalletWatchlist";
import { compactAddress, formatCurrency } from "../utils/format";

const MIN_QUERY_LENGTH = 3;

export default function WalletSearchPanel() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWalletWatchlist();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["wallet-search", debouncedQuery],
    queryFn: () => fetcher<WalletSearchResult[]>(`/wallets/search?q=${debouncedQuery}`),
    enabled: debouncedQuery.length >= MIN_QUERY_LENGTH
  });

  const watchlistMap = useMemo(
    () => new Map(watchlist.map((item) => [item.address, item])),
    [watchlist]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!debouncedQuery) return;
    const topResult = results[0];
    if (topResult) {
      navigate(`/wallet/${topResult.address}`);
    }
  };

  const toggleWatch = (address: string) => {
    if (watchlistMap.has(address)) {
      removeFromWatchlist(address);
    } else {
      addToWatchlist({ address, createdAt: Date.now() });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value.trimStart())}
          placeholder="搜尋錢包地址或標籤…"
          className="w-full rounded-full border border-slate-800 bg-slate-900/60 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary-500 px-4 py-1 text-xs font-semibold text-slate-900 hover:bg-primary-400"
        >
          前往
        </button>
      </form>

      <section className="space-y-3">
        <header className="flex items-center justify-between text-xs text-slate-400">
          <span>搜尋結果</span>
          {isFetching && <span>搜尋中…</span>}
        </header>
        <ul className="space-y-2 text-sm text-slate-300">
          {debouncedQuery.length < MIN_QUERY_LENGTH && (
            <li className="text-xs text-slate-500">輸入至少 {MIN_QUERY_LENGTH} 個字元開始搜尋。</li>
          )}
          {debouncedQuery.length >= MIN_QUERY_LENGTH && results.length === 0 && !isFetching && (
            <li className="text-xs text-slate-500">沒有符合的錢包。</li>
          )}
          {results.map((wallet) => (
            <li
              key={wallet.address}
              className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2"
            >
              <div className="space-y-1">
                <button
                  type="button"
                  className="text-left text-sm text-white hover:text-primary-200"
                  onClick={() => navigate(`/wallet/${wallet.address}`)}
                >
                  {wallet.label ?? compactAddress(wallet.address)}
                </button>
                <p className="text-xs text-slate-400">
                  {formatCurrency(wallet.totalValueUsd)} · 7 天 PnL {formatCurrency(wallet.pnl7d)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleWatch(wallet.address)}
                className="ml-2 inline-flex items-center gap-1 text-xs text-primary-300 hover:text-primary-100"
              >
                {watchlistMap.has(wallet.address) ? (
                  <>
                    <StarOff className="h-4 w-4" /> 取消
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4" /> 關注
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <header className="flex items-center justify-between text-xs text-slate-400">
          <span>關注錢包</span>
          <span>{watchlist.length} 個</span>
        </header>
        {watchlist.length === 0 ? (
          <p className="text-xs text-slate-500">尚未關注任何錢包，從搜尋結果中加入追蹤。</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {watchlist.map((wallet) => (
              <li
                key={wallet.address}
                className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/wallet/${wallet.address}`)}
                  className="text-left text-white hover:text-primary-200"
                >
                  {wallet.alias ?? compactAddress(wallet.address)}
                </button>
                <button
                  type="button"
                  onClick={() => removeFromWatchlist(wallet.address)}
                  className="text-xs text-slate-500 hover:text-red-400"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
