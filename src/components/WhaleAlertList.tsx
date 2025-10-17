import { memo } from "react";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Link as LinkIcon } from "lucide-react";
import { WhaleAlert } from "../types";
import { compactAddress, formatCurrency, formatNumber, timeAgo } from "../utils/format";

interface Props {
  alerts: WhaleAlert[];
  isLoading: boolean;
}

function WhaleAlertList({ alerts, isLoading }: Props) {
  if (isLoading && alerts.length === 0) {
    return <p className="mt-4 text-sm text-slate-400">載入告警中…</p>;
  }

  if (alerts.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">尚未收到大戶告警。</p>;
  }

  return (
    <ul className="mt-4 space-y-3 overflow-y-auto pr-1 text-sm scrollbar-thin" style={{ maxHeight: "22rem" }}>
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className="flex flex-col gap-2 rounded-lg border border-slate-800/70 bg-slate-900/60 p-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 text-slate-300">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              {alert.exchange.toUpperCase()}
            </span>
            <span>{timeAgo(alert.timestamp)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                {alert.side === "buy" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <ArrowUpCircle className="h-4 w-4" /> Buy
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <ArrowDownCircle className="h-4 w-4" /> Sell
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                數量 {formatNumber(alert.amount)} @ {formatCurrency(alert.price)}
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>錢包：{compactAddress(alert.walletAddress)}</p>
              <a
                href={`https://explorer.xyz/tx/${alert.txHash}`}
                className="inline-flex items-center gap-1 text-primary-300 hover:text-primary-100"
                target="_blank"
                rel="noreferrer"
              >
                查看交易 <LinkIcon className="h-3 w-3" />
              </a>
            </div>
          </div>
          {alert.note && <p className="text-xs text-slate-400">{alert.note}</p>}
        </li>
      ))}
    </ul>
  );
}

export default memo(WhaleAlertList);
