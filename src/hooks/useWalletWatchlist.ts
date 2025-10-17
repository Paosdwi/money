import { useMemo } from "react";
import { useWatchlistStore } from "../store/watchlistStore";

export default function useWalletWatchlist() {
  const watchlist = useWatchlistStore((state) => state.watchlist);
  const addToWatchlist = useWatchlistStore((state) => state.addToWatchlist);
  const removeFromWatchlist = useWatchlistStore((state) => state.removeFromWatchlist);
  const updateAlias = useWatchlistStore((state) => state.updateAlias);

  return useMemo(
    () => ({
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      updateAlias
    }),
    [watchlist, addToWatchlist, removeFromWatchlist, updateAlias]
  );
}
