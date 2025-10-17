import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WalletWatchItem } from "../types";

interface WatchlistState {
  watchlist: WalletWatchItem[];
  addToWatchlist: (item: WalletWatchItem) => void;
  removeFromWatchlist: (address: string) => void;
  updateAlias: (address: string, alias: string) => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set) => ({
      watchlist: [],
      addToWatchlist: (item) =>
        set((state) => {
          if (state.watchlist.some((existing) => existing.address === item.address)) {
            return state;
          }
          return {
            watchlist: [item, ...state.watchlist].slice(0, 50)
          };
        }),
      removeFromWatchlist: (address) =>
        set((state) => ({
          watchlist: state.watchlist.filter((item) => item.address !== address)
        })),
      updateAlias: (address, alias) =>
        set((state) => ({
          watchlist: state.watchlist.map((item) =>
            item.address === address
              ? {
                  ...item,
                  alias
                }
              : item
          )
        }))
    }),
    {
      name: "money-watchlist"
    }
  )
);
