# money

現代化的多交易所整合框架，提供下列功能：

- 針對 Binance、Coinbase 與 OKX 撰寫的連線模組，整合 REST/WebSocket 邏輯並內建錯誤重試。
- 統一的行情資料與錢包事件資料模型，透過 Pydantic 進行驗證。
- API 金鑰管理、速率限制工具、異常告警機制與自動重試。
- 區塊鏈資料客戶端，可串接第三方服務或自有節點以解析鏈上錢包事件。

## 安裝

```bash
pip install -r requirements.txt
```

## 快速開始

```python
import asyncio
from money.core import ApiKeyStore, AsyncRateLimiter, ApiKey
from money.exchanges import BinanceConnector

api_keys = ApiKeyStore()
api_keys.set_key("binance", ApiKey(key="your_key", secret="your_secret"))
rate_limiter = AsyncRateLimiter(rate=10)
connector = BinanceConnector(api_keys=api_keys, rate_limiter=rate_limiter)

async def main():
    ticker = await connector.fetch_price("BTCUSDT")
    print(ticker)
    await connector.close()

asyncio.run(main())
```

## 區塊鏈整合

```python
from money.blockchain import BlockchainClient

client = BlockchainClient(endpoint="https://your-node")
```

更多使用情境請參考 `money` 模組中的程式碼。
