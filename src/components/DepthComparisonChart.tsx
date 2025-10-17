import { useMemo } from "react";
import { area, curveMonotoneX } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { extent, max } from "d3-array";
import { DepthSnapshot } from "../types";
import { formatNumber } from "../utils/format";

interface Props {
  depthSnapshots: DepthSnapshot[];
  isLoading: boolean;
}

const COLORS = {
  bids: "#22c55e",
  asks: "#f97316"
};

const WIDTH = 720;
const HEIGHT = 280;

function DepthComparisonChart({ depthSnapshots, isLoading }: Props) {
  const series = useMemo(() => {
    if (!depthSnapshots.length) return [];

    const rawPriceRange = extent(
      depthSnapshots.flatMap((snapshot) => [
        snapshot.bids[0]?.price ?? 0,
        snapshot.asks[snapshot.asks.length - 1]?.price ?? 0
      ])
    ) as [number | undefined, number | undefined];

    const priceRange: [number, number] = [
      rawPriceRange[0] ?? 0,
      rawPriceRange[1] ?? (rawPriceRange[0] ?? 1)
    ];
    if (priceRange[0] === priceRange[1]) {
      priceRange[1] = priceRange[0] + 1;
    }

    const maxSize = max(
      depthSnapshots.flatMap((snapshot) => [...snapshot.bids, ...snapshot.asks].map((entry) => entry.size))
    );

    const xScale = scaleLinear().domain(priceRange).range([0, WIDTH]);
    const yScale = scaleLinear().domain([0, maxSize ?? 1]).range([HEIGHT, 0]);

    const depthArea = area<{ price: number; size: number }>()
      .x((d) => xScale(d.price))
      .y0(() => yScale(0))
      .y1((d) => yScale(d.size))
      .curve(curveMonotoneX);

    return depthSnapshots.map((snapshot) => ({
      exchange: snapshot.exchange,
      bidsPath: snapshot.bids.length ? depthArea(snapshot.bids) : undefined,
      asksPath: snapshot.asks.length ? depthArea(snapshot.asks) : undefined,
      bestBid: snapshot.bids[0],
      bestAsk: snapshot.asks[0],
      timestamp: snapshot.timestamp
    }));
  }, [depthSnapshots]);

  if (isLoading && !depthSnapshots.length) {
    return <p className="mt-6 text-sm text-slate-400">載入深度資料中…</p>;
  }

  return (
    <div className="mt-4 grid gap-4">
      {series.map((snapshot) => (
        <article
          key={snapshot.exchange}
          className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-inner shadow-slate-950/30"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <span className="text-white">{snapshot.exchange.toUpperCase()}</span>
            <span>
              最佳買價：<span className="text-emerald-400">{formatNumber(snapshot.bestBid?.price ?? 0)}</span>
            </span>
            <span>
              最佳賣價：<span className="text-orange-400">{formatNumber(snapshot.bestAsk?.price ?? 0)}</span>
            </span>
            <span className="text-xs text-slate-500">
              更新：{new Date(snapshot.timestamp).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </header>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-4 h-48 w-full">
            <path d={snapshot.bidsPath ?? undefined} fill={`${COLORS.bids}33`} stroke={COLORS.bids} strokeWidth={1.5} />
            <path d={snapshot.asksPath ?? undefined} fill={`${COLORS.asks}33`} stroke={COLORS.asks} strokeWidth={1.5} />
          </svg>
        </article>
      ))}
      {!series.length && !isLoading && (
        <p className="text-sm text-slate-500">尚無深度資料，等待即時串流。</p>
      )}
    </div>
  );
}

export default DepthComparisonChart;
