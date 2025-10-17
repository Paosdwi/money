export function formatCurrency(value: number, options: Intl.NumberFormatOptions = {}): string {
  if (Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value > 1000 ? 2 : 4,
    ...options
  }).format(value);
}

export function formatPercent(value: number, fractionDigits = 2): string {
  if (Number.isNaN(value)) return "-";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: fractionDigits
  });
  return formatter.format(value / 100);
}

export function formatNumber(value: number, fractionDigits = 2): string {
  if (Number.isNaN(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(fractionDigits)}B`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(fractionDigits)}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(fractionDigits)}K`;
  }
  return value.toFixed(fractionDigits);
}

export function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s 前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m 前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h 前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d 前`;
}

export function compactAddress(address: string, size = 4): string {
  if (address.length <= size * 2) return address;
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
}
