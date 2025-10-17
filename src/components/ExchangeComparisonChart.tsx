import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar
} from "recharts";
import { PricePoint, VolumePoint } from "../types";
import { formatCurrency, formatNumber } from "../utils/format";
import { useMemo } from "react";

interface Props {
  priceHistory: PricePoint[];
  volumeHistory: VolumePoint[];
  isLoading: boolean;
}

const COLORS = ["#4ADE80", "#60A5FA", "#FBBF24", "#F97316", "#F87171"];

function ExchangeComparisonChart({ priceHistory, volumeHistory, isLoading }: Props) {
  const data = useMemo(() => {
    return priceHistory.map((pricePoint) => {
      const volumePoint = volumeHistory.find((item) => item.timestamp === pricePoint.timestamp);
      const volumeEntries = Object.entries(volumePoint?.values ?? {}).reduce(
        (acc, [exchange, value]) => ({
          ...acc,
          [`${exchange}_volume`]: value
        }),
        {}
      );
      return {
        timestamp: pricePoint.timestamp,
        ...pricePoint.values,
        ...volumeEntries
      };
    });
  }, [priceHistory, volumeHistory]);

  if (isLoading && data.length === 0) {
    return <p className="mt-6 text-sm text-slate-400">載入即時資料中…</p>;
  }

  const exchangeIds = Object.keys(priceHistory[0]?.values ?? {});

  return (
    <div className="mt-4 space-y-6">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} syncId="exchange">
            <defs>
              {exchangeIds.map((exchange, index) => (
                <linearGradient id={`color-${exchange}`} key={exchange} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
              stroke="#64748B"
            />
            <YAxis
              stroke="#64748B"
              tickFormatter={(value) => formatCurrency(value, { maximumFractionDigits: 0 })}
              domain={["dataMin", "dataMax"]}
            />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }}
              labelFormatter={(value) => new Date(value).toLocaleString("zh-TW")}
              formatter={(value: number, name: string) => [formatCurrency(value), name.toUpperCase()]}
            />
            <Legend />
            {exchangeIds.map((exchange, index) => (
              <Area
                key={exchange}
                type="monotone"
                dataKey={exchange}
                stroke={COLORS[index % COLORS.length]}
                fill={`url(#color-${exchange})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId="exchange">
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
              stroke="#64748B"
            />
            <YAxis stroke="#64748B" tickFormatter={(value) => formatNumber(value)} domain={[0, "auto"]} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }}
              labelFormatter={(value) => new Date(value).toLocaleString("zh-TW")}
              formatter={(value: number, name: string) => [formatNumber(value), name.toUpperCase()]}
            />
            {exchangeIds.map((exchange, index) => (
              <Bar
                key={exchange}
                dataKey={`${exchange}_volume`}
                name={`${exchange.toUpperCase()} Volume`}
                stackId="volume"
                fill={COLORS[index % COLORS.length]}
                maxBarSize={32}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ExchangeComparisonChart;
