# Exchange API Research

This document summarizes the official market data and account (or wallet) endpoints for Binance, OKX, and Coinbase, with an emphasis on authentication flows and published rate limits. Values reflect public documentation as of 2024-06 and should be revalidated before production rollout.

## Binance
- **Market Data Endpoints**
  - REST: `/api/v3/ticker/price`, `/api/v3/depth`, `/api/v3/klines` for spot; `/fapi/v1/...` and `/dapi/v1/...` for futures.
  - WebSocket: `wss://stream.binance.com:9443/stream` (spot) and dedicated futures streams for aggregated trades, depth, and kline updates.
- **Account/Trading Endpoints**
  - REST: `/api/v3/account`, `/api/v3/myTrades`, `/api/v3/order`; futures variants under `/fapi/v1/` and `/dapi/v1/`.
  - WebSocket user data streams provide order and balance updates.
- **Authentication**
  - API key + secret via HMAC-SHA256 signature of query string; timestamp required. WebSocket user data streams require REST listen key creation.
- **Rate Limits**
  - REST uses a weight-based quota with a default limit of 1,200 weight per minute (spot) and specific weights per endpoint.
  - WebSocket streams limited to 5 connections per account and 300 messages/minute per connection (soft limit). Excess connections are terminated.

## OKX
- **Market Data Endpoints**
  - REST: `/api/v5/market/ticker`, `/api/v5/market/books`, `/api/v5/market/candles` across spot, futures, swap, and options.
  - WebSocket: `wss://ws.okx.com:8443/ws/v5/public` for public market feeds.
- **Account/Trading Endpoints**
  - REST: `/api/v5/account/balance`, `/api/v5/account/positions`, `/api/v5/trade/order`, `/api/v5/asset/withdrawal`.
  - WebSocket private channel: `wss://ws.okx.com:8443/ws/v5/private` for order, balance, and position updates.
- **Authentication**
  - API key, passphrase, and secret used to sign request headers (`OK-ACCESS-KEY`, `OK-ACCESS-PASSPHRASE`, `OK-ACCESS-SIGN`, `OK-ACCESS-TIMESTAMP`). Signatures created with HMAC-SHA256 over the timestamp + method + path + body.
  - WebSocket private channels use the same signature in login payload.
- **Rate Limits**
  - REST default: 60 requests per 2 seconds per IP for public endpoints; 20 requests per 2 seconds per account for private endpoints (varies by product).
  - WebSocket: 240 subscription events per minute, 20 login attempts per 2 hours. Order placement via WebSocket limited to 50 requests per 2 seconds.

## Coinbase (Advanced Trade / Coinbase Exchange)
- **Market Data Endpoints**
  - REST: `/api/v3/brokerage/products`, `/api/v3/brokerage/market/products/<product_id>/ticker`, `/products/<product_id>/candles` (Exchange).
  - WebSocket: `wss://advanced-trade-ws.coinbase.com` (Advanced Trade) and `wss://ws-feed.exchange.coinbase.com` (Exchange) providing ticker, level2, and user channels.
- **Account/Trading Endpoints**
  - REST: `/api/v3/brokerage/accounts`, `/api/v3/brokerage/orders`, `/accounts`, `/orders` (Exchange legacy).
  - WebSocket user channel delivers order lifecycle updates.
- **Authentication**
  - API key, API secret, and passphrase. REST requests require CB-ACCESS-KEY, CB-ACCESS-SIGN (HMAC-SHA256 over timestamp + method + request path + body), CB-ACCESS-TIMESTAMP, and CB-ACCESS-PASSPHRASE headers.
  - WebSocket authentication mirrors REST signing in the login message.
- **Rate Limits**
  - Advanced Trade REST: up to 3,500 requests per minute per API key, subject to dynamic weight for certain endpoints.
  - Exchange REST: 10 requests per second, 25,000 requests per day (default). WebSocket limited to 50 subscriptions per connection; order placement limited to 5 requests per second (per profile).

## Integration Notes
- Market data should primarily rely on WebSocket subscriptions for low latency while using REST as fallback/backfill.
- Account endpoints generally require signed requests; secure storage of secrets and clock synchronization (NTP) are mandatory.
- Exchange-specific throttle handling (weight counters, burst control) should be implemented at the client wrapper layer.
