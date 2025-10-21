import { createServer } from "http";
import { createHash } from "crypto";
import { performance } from "perf_hooks";

const BinanceWebSocket = globalThis.WebSocket;
if (typeof BinanceWebSocket !== "function") {
  throw new Error("WebSocket support is required to run the Binance bridge server.");
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const BINANCE_REST_BASE = "https://api1.binance.com";
const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream";
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const SYMBOLS = [
  { symbol: "BTCUSDT", id: "binance-btcusdt", name: "Binance BTC/USDT" },
  { symbol: "ETHUSDT", id: "binance-ethusdt", name: "Binance ETH/USDT" },
  { symbol: "BNBUSDT", id: "binance-bnbusdt", name: "Binance BNB/USDT" }
];

const whaleAlerts = [
  {
    id: "alert-1",
    exchange: "Binance",
    symbol: "BTC",
    side: "buy",
    amount: 842.5,
    valueUsd: 54000000,
    hash: "0x1f3a...c9e2",
    timestamp: Date.now() - 1000 * 60
  },
  {
    id: "alert-2",
    exchange: "Binance",
    symbol: "ETH",
    side: "sell",
    amount: 12800,
    valueUsd: 41000000,
    hash: "0x9a0b...ff12",
    timestamp: Date.now() - 1000 * 60 * 3
  },
  {
    id: "alert-3",
    exchange: "Binance",
    symbol: "BNB",
    side: "buy",
    amount: 620000,
    valueUsd: 9500000,
    hash: "0x5c8d...92aa",
    timestamp: Date.now() - 1000 * 60 * 5
  }
];

const walletDirectory = [
  {
    address: "0x8d12a197cb00d4747a1fe03395095ce2a5cc6819",
    owner: "Market Maker A",
    tags: ["market-maker", "binance"],
    chains: ["ethereum"],
    balanceUsd: 154000000,
    positions: [
      { symbol: "BTC", amount: 820, valueUsd: 52500000 },
      { symbol: "ETH", amount: 12000, valueUsd: 40500000 },
      { symbol: "USDT", amount: 42000000, valueUsd: 42000000 }
    ],
    transactions: Array.from({ length: 6 }).map((_, index) => ({
      hash: `0x${(1000 + index).toString(16)}...${(2000 + index).toString(16)}`,
      type: index % 2 === 0 ? "transfer" : "swap",
      valueUsd: 2500000 + index * 125000,
      timestamp: Date.now() - index * 1000 * 60 * 15
    }))
  },
  {
    address: "0x742d35cc6634c0532925a3b844bc454e4438f44e",
    owner: "Whale Fund B",
    tags: ["whale", "long-term"],
    chains: ["ethereum", "polygon"],
    balanceUsd: 284000000,
    positions: [
      { symbol: "BTC", amount: 1280, valueUsd: 82000000 },
      { symbol: "ETH", amount: 24000, valueUsd: 81000000 },
      { symbol: "USDC", amount: 121000000, valueUsd: 121000000 }
    ],
    transactions: Array.from({ length: 4 }).map((_, index) => ({
      hash: `0x${(3000 + index).toString(16)}...${(4000 + index).toString(16)}`,
      type: index % 2 === 0 ? "transfer" : "deposit",
      valueUsd: 4300000 + index * 200000,
      timestamp: Date.now() - index * 1000 * 60 * 45
    }))
  },
  {
    address: "0xfe9e8709d3215310075d67e3ed32a380ccf451c8",
    owner: "Liquidity Provider C",
    tags: ["liquidity", "bnb-chain"],
    chains: ["bnb", "arbitrum"],
    balanceUsd: 96000000,
    positions: [
      { symbol: "BNB", amount: 82000, valueUsd: 32000000 },
      { symbol: "BUSD", amount: 41000000, valueUsd: 41000000 },
      { symbol: "ARB", amount: 1600000, valueUsd: 23000000 }
    ],
    transactions: Array.from({ length: 5 }).map((_, index) => ({
      hash: `0x${(5000 + index).toString(16)}...${(6000 + index).toString(16)}`,
      type: index % 2 === 0 ? "provide-liquidity" : "withdraw",
      valueUsd: 3100000 + index * 175000,
      timestamp: Date.now() - index * 1000 * 60 * 30
    }))
  }
];

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function notFound(res) {
  sendJson(res, { message: "Not Found" }, 404);
}

function methodNotAllowed(res) {
  sendJson(res, { message: "Method Not Allowed" }, 405);
}

function normalizeSymbol(symbol) {
  return symbol.toUpperCase();
}

class BinanceFeed {
  constructor(symbols) {
    this.symbols = symbols.map((entry) => ({
      ...entry,
      symbol: normalizeSymbol(entry.symbol)
    }));
    this.tickerCache = new Map();
    this.depthCache = new Map();
    this.apiLatency = 0;
    this.wsLatency = 0;
    this.averageSpread = 0;
    this.initialFetch = null;
    this.updateHandler = null;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.lastErrorLog = 0;
  }

  start() {
    this.initialFetch = this.refreshTickerCache();
    this.initialFetch.catch((error) => {
      console.error("Failed to prime Binance ticker cache", error);
    });

    setInterval(() => {
      this.refreshTickerCache().catch((error) => {
        console.error("Failed to refresh Binance ticker cache", error);
      });
    }, 60_000);

    this.connectStream();
  }

  async waitForInitialTicker() {
    if (this.initialFetch) {
      try {
        await this.initialFetch;
      } catch (error) {
        // ignore failures, cached/default values will be used instead
      }
    }
  }

  async refreshTickerCache() {
    const url = new URL("/api/v3/ticker/24hr", BINANCE_REST_BASE);
    url.searchParams.set(
      "symbols",
      JSON.stringify(this.symbols.map((entry) => entry.symbol))
    );

    const start = performance.now();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Binance REST request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const end = performance.now();
    this.apiLatency = Math.round(end - start);

    payload.forEach((ticker) => {
      const symbol = normalizeSymbol(ticker.symbol);
      this.tickerCache.set(symbol, ticker);
    });
    this.recalculateAverageSpread();
  }

  connectStream() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.safeCloseSocket();
    }

    const streams = [
      ...this.symbols.map((entry) => `${entry.symbol.toLowerCase()}@ticker`),
      ...this.symbols.map((entry) => `${entry.symbol.toLowerCase()}@depth5@1000ms`)
    ];
    const url = `${BINANCE_WS_BASE}?streams=${streams.join("/")}`;
    const socket = new BinanceWebSocket(url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      console.log("Connected to Binance combined stream");
    });

    socket.addEventListener("message", async (event) => {
      try {
        let raw = event.data;
        if (typeof raw === "string") {
          // already a string
        } else if (raw instanceof ArrayBuffer) {
          raw = Buffer.from(raw).toString();
        } else if (ArrayBuffer.isView(raw)) {
          raw = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString();
        } else if (raw && typeof raw.arrayBuffer === "function") {
          raw = Buffer.from(await raw.arrayBuffer()).toString();
        } else {
          raw = Buffer.from(raw ?? []).toString();
        }
        const payload = JSON.parse(raw);
        this.handleStreamMessage(payload);
      } catch (error) {
        console.error("Failed to parse Binance stream payload", error);
      }
    });

    socket.addEventListener("close", (event) => {
      this.socket = null;
      console.warn(
        `Binance stream closed (code=${event?.code ?? "unknown"}), scheduling reconnect`
      );
      this.scheduleReconnect();
    });

    socket.addEventListener("error", (error) => {
      this.logStreamError(error);
      this.safeCloseSocket();
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts += 1;
    let delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    if (this.reconnectAttempts > 6) {
      delay = 60_000;
    }
    if (this.reconnectAttempts > 10) {
      delay = 300_000;
      this.reconnectAttempts = 0;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectStream();
    }, delay);
  }

  safeCloseSocket() {
    if (!this.socket) return;
    const readyState = this.socket.readyState;
    const closingStates = [
      BinanceWebSocket.CLOSING ?? 2,
      BinanceWebSocket.CLOSED ?? 3
    ];
    if (closingStates.includes(readyState)) {
      return;
    }
    try {
      this.socket.close();
    } catch (error) {
      this.logStreamError(error);
    }
  }

  logStreamError(error) {
    const now = Date.now();
    if (now - this.lastErrorLog > 10_000) {
      console.error("Binance stream error", error);
      this.lastErrorLog = now;
    }
  }

  handleStreamMessage(message) {
    if (!message || !message.stream || !message.data) return;

    const stream = message.stream;
    const data = message.data;

    if (stream.endsWith("@ticker")) {
      const symbol = normalizeSymbol(data.s ?? data.symbol);
      this.tickerCache.set(symbol, data);
      if (typeof data.E === "number") {
        this.wsLatency = Math.max(0, Date.now() - data.E);
      }
    }

    if (stream.includes("@depth")) {
      const symbol = normalizeSymbol(data.s ?? data.symbol);
      this.depthCache.set(symbol, {
        bids: (data.bids ?? data.b ?? []).map(([price, size]) => ({
          price: Number(price),
          size: Number(size)
        })),
        asks: (data.asks ?? data.a ?? []).map(([price, size]) => ({
          price: Number(price),
          size: Number(size)
        }))
      });
      if (typeof data.E === "number") {
        this.wsLatency = Math.max(0, Date.now() - data.E);
      }
      this.recalculateAverageSpread();
    }

    if (this.updateHandler) {
      this.updateHandler();
    }
  }

  recalculateAverageSpread() {
    const spreads = [];
    this.symbols.forEach((entry) => {
      const depth = this.depthCache.get(entry.symbol);
      if (!depth) return;
      if (!depth.bids.length || !depth.asks.length) return;
      const spread = depth.asks[0].price - depth.bids[0].price;
      if (!Number.isFinite(spread)) return;
      spreads.push(spread);
    });
    this.averageSpread = spreads.length
      ? spreads.reduce((acc, value) => acc + value, 0) / spreads.length
      : 0;
  }

  setUpdateHandler(handler) {
    this.updateHandler = handler;
  }

  getExchangeSummaries() {
    return this.symbols.map((entry) => {
      const ticker = this.tickerCache.get(entry.symbol);
      if (!ticker) {
        return {
          id: entry.id,
          name: entry.name,
          lastPrice: 0,
          change24h: 0,
          volume24h: 0,
          status: "degraded",
          latency: this.apiLatency
        };
      }

      return {
        id: entry.id,
        name: entry.name,
        lastPrice: Number(ticker.c ?? ticker.lastPrice ?? 0),
        change24h: Number(ticker.P ?? ticker.priceChangePercent ?? 0),
        volume24h: Number(ticker.q ?? ticker.quoteVolume ?? 0),
        status: "operational",
        latency: this.apiLatency
      };
    });
  }

  getMarketSnapshot() {
    const timestamp = Date.now();
    const prices = {};
    const volumes = {};
    const depth = [];
    let dominantExchange = this.symbols[0]?.id ?? "binance";
    let highestVolume = -Infinity;

    this.symbols.forEach((entry) => {
      const ticker = this.tickerCache.get(entry.symbol);
      if (ticker) {
        const price = Number(ticker.c ?? ticker.lastPrice ?? 0);
        const volume = Number(ticker.q ?? ticker.quoteVolume ?? 0);
        prices[entry.id] = price;
        volumes[entry.id] = volume;
        if (volume > highestVolume) {
          dominantExchange = entry.id;
          highestVolume = volume;
        }
      }

      const depthSnapshot = this.depthCache.get(entry.symbol);
      if (depthSnapshot) {
        depth.push({
          exchange: entry.name,
          bids: depthSnapshot.bids,
          asks: depthSnapshot.asks
        });
      }
    });

    return {
      timestamp,
      dominantExchange,
      prices,
      volumes,
      depth,
      latency: {
        apiLatency: this.apiLatency,
        wsLatency: this.wsLatency,
        averageSpread: this.averageSpread
      }
    };
  }
}

const feed = new BinanceFeed(SYMBOLS);
feed.start();

function findWallet(address) {
  const normalized = address.toLowerCase();
  return walletDirectory.find((wallet) => wallet.address.toLowerCase() === normalized);
}

function generateWhaleAlert() {
  const symbols = ["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE"];
  const sides = ["buy", "sell"];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const side = sides[Math.floor(Math.random() * sides.length)];
  const amount = Number((Math.random() * 1000 + 10).toFixed(2));
  const price =
    feed.tickerCache.get("BTCUSDT")?.c ?? feed.tickerCache.get("ETHUSDT")?.c ?? 0;
  const valueUsd = Math.round(amount * Number(price || 1));

  return {
    id: `alert-${Date.now()}`,
    exchange: "Binance",
    symbol,
    side,
    amount,
    valueUsd,
    hash: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random()
      .toString(16)
      .slice(2, 10)}`,
    timestamp: Date.now()
  };
}

const server = createServer(async (req, res) => {
  setCors(res);
  const { method, url } = req;
  if (!url) {
    notFound(res);
    return;
  }

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (method !== "GET") {
    methodNotAllowed(res);
    return;
  }

  const parsedUrl = new URL(url, `http://${req.headers.host ?? "localhost"}`);

  if (parsedUrl.pathname === "/exchanges") {
    await feed.waitForInitialTicker();
    sendJson(res, feed.getExchangeSummaries());
    return;
  }

  if (parsedUrl.pathname === "/alerts/whales") {
    sendJson(res, whaleAlerts);
    return;
  }

  if (parsedUrl.pathname === "/wallets/search") {
    const query = (parsedUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    if (!query) {
      sendJson(res, []);
      return;
    }

    const results = walletDirectory.filter((wallet) => {
      return (
        wallet.address.toLowerCase().includes(query) ||
        wallet.owner.toLowerCase().includes(query) ||
        wallet.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });

    sendJson(
      res,
      results.map((wallet) => ({
        address: wallet.address,
        owner: wallet.owner,
        tags: wallet.tags,
        balanceUsd: wallet.balanceUsd
      }))
    );
    return;
  }

  if (parsedUrl.pathname.startsWith("/wallets/")) {
    const address = parsedUrl.pathname.split("/")[2];
    if (!address) {
      notFound(res);
      return;
    }

    const wallet = findWallet(address);
    if (!wallet) {
      notFound(res);
      return;
    }

    sendJson(res, wallet);
    return;
  }

  notFound(res);
});

const sockets = new Set();
const marketSubscribers = new Set();
const whaleSubscribers = new Set();
let whaleInterval = null;

function send(socket, payload) {
  if (socket.destroyed) return;
  try {
    const frame = encodeFrame(JSON.stringify(payload));
    socket.write(frame);
  } catch (error) {
    console.error("Failed to send WebSocket payload", error);
  }
}

function sendMarketSnapshot(socket) {
  const snapshot = feed.getMarketSnapshot();
  if (!snapshot) return;
  send(socket, { topic: "market", ...snapshot });
}

function broadcastMarketSnapshot() {
  if (marketSubscribers.size === 0) return;
  const snapshot = feed.getMarketSnapshot();
  if (!snapshot) return;
  marketSubscribers.forEach((socket) => {
    send(socket, { topic: "market", ...snapshot });
  });
}

function sendWhaleAlert(socket) {
  send(socket, { topic: "whale-alerts", alerts: [generateWhaleAlert()] });
}

function broadcastWhaleAlert() {
  if (whaleSubscribers.size === 0) return;
  const alert = generateWhaleAlert();
  whaleSubscribers.forEach((socket) => {
    send(socket, { topic: "whale-alerts", alerts: [alert] });
  });
}

function ensureWhaleInterval() {
  if (whaleInterval) return;
  whaleInterval = setInterval(() => {
    if (whaleSubscribers.size === 0) {
      clearInterval(whaleInterval);
      whaleInterval = null;
      return;
    }
    broadcastWhaleAlert();
  }, 5000);
}

function cleanupSocket(socket) {
  sockets.delete(socket);
  marketSubscribers.delete(socket);
  whaleSubscribers.delete(socket);
}

feed.setUpdateHandler(() => {
  if (marketSubscribers.size > 0) {
    broadcastMarketSnapshot();
  }
});

server.on("upgrade", (req, socket) => {
  if ((req.headers.upgrade ?? "").toLowerCase() !== "websocket") {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key || Array.isArray(key)) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }

  const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      ""
    ].join("\r\n")
  );

  sockets.add(socket);

  socket.on("data", (buffer) => {
    const frames = decodeFrames(buffer);
    frames.forEach((frame) => {
      if (frame.type === "ping") {
        socket.write(encodeFrame(Buffer.alloc(0), 0x8a));
        return;
      }

      if (frame.type === "close") {
        socket.end(encodeFrame(Buffer.alloc(0), 0x88));
        cleanupSocket(socket);
        return;
      }

      if (frame.type === "text") {
        try {
          const payload = JSON.parse(frame.data);
          const topic = payload?.topic;

          if (topic === "market") {
            marketSubscribers.add(socket);
            sendMarketSnapshot(socket);
            return;
          }

          if (topic === "whale-alerts") {
            whaleSubscribers.add(socket);
            ensureWhaleInterval();
            sendWhaleAlert(socket);
            return;
          }
        } catch (error) {
          console.error("Failed to parse client WebSocket payload", error);
        }
      }
    });
  });

  socket.on("close", () => {
    cleanupSocket(socket);
  });

  socket.on("end", () => {
    cleanupSocket(socket);
  });

  socket.on("error", () => {
    cleanupSocket(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

function encodeFrame(data, opcode = 0x81) {
  const payload = typeof data === "string" ? Buffer.from(data) : data;
  const length = payload.length;

  if (length < 126) {
    const frame = Buffer.alloc(2 + length);
    frame[0] = opcode;
    frame[1] = length;
    payload.copy(frame, 2);
    return frame;
  }

  if (length < 65536) {
    const frame = Buffer.alloc(4 + length);
    frame[0] = opcode;
    frame[1] = 126;
    frame.writeUInt16BE(length, 2);
    payload.copy(frame, 4);
    return frame;
  }

  const frame = Buffer.alloc(10 + length);
  frame[0] = opcode;
  frame[1] = 127;
  frame.writeBigUInt64BE(BigInt(length), 2);
  payload.copy(frame, 10);
  return frame;
}

function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset < buffer.length) {
    const byte1 = buffer[offset];
    const opcode = byte1 & 0x0f;
    const byte2 = buffer[offset + 1];
    const isMasked = (byte2 & 0x80) === 0x80;
    let payloadLength = byte2 & 0x7f;
    offset += 2;

    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      payloadLength = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let maskingKey;
    if (isMasked) {
      maskingKey = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    const payload = buffer.slice(offset, offset + payloadLength);
    offset += payloadLength;

    if (isMasked && maskingKey) {
      for (let i = 0; i < payload.length; i += 1) {
        payload[i] ^= maskingKey[i % 4];
      }
    }

    if (opcode === 0x1) {
      frames.push({ type: "text", data: payload.toString("utf8") });
    } else if (opcode === 0x8) {
      frames.push({ type: "close" });
    } else if (opcode === 0x9) {
      frames.push({ type: "ping" });
    } else if (opcode === 0xa) {
      frames.push({ type: "pong" });
    }
  }

  return frames;
}
