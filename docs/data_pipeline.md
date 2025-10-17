# 實時交易資料管線設計

## 1. 事件管線與 Topic/Stream 架構
- **事件平台**：採用 Kafka 作為主事件總線，Redis Streams 作為邊緣緩衝與快速回放。
- **Topic 命名原則**：`<市場>.<資料類型>.<頻率>`，例如 `twse.trades.raw`、`twse.orderbook.delta`、`twse.trades.agg1s`。
- **分割策略**：依市場及證券代碼 hash 分割，確保同一標的資料有序且分散負載。
- **Redis Streams 使用情境**：
  - 交易所邊緣節點先寫入 `stream:twse:trades`，提供故障緩衝與快速抓取最新 N 筆資料的能力。
  - 後端消費者會將資料同步到 Kafka `twse.trades.raw`。
- **Schema Registry**：使用 Confluent Schema Registry（Avro/Protobuf）維持訊息結構一致性。

## 2. 消費者服務：資料清洗、轉換與聚合
- **Raw Ingestor**：
  - 從 Kafka `twse.trades.raw` 取出資料，進行欄位驗證、時戳校正、異常值檢測（價格跳動、成交量 0 等）。
  - 清洗後寫入 `twse.trades.cleaned`。
- **Transformer**：
  - 將清洗資料轉換成標準化 schema（加入 VWAP、價量比等欄位）。
  - 產出多個下游 topic，例如 `twse.trades.normalized`。
- **Aggregator**：
  - 使用 Kafka Streams / Flink 做窗口聚合，計算每秒成交量（volume_per_sec）、買賣力量差（bid_ask_delta）等指標。
  - 結果寫入 `twse.trades.agg1s`、`twse.trades.agg1m`。
- **錯誤處理與監控**：
  - 異常訊息送至 `twse.trades.dlq`。
  - Prometheus + Grafana 監控消費延遲、失敗率。

## 3. 熱儲存與冷儲存設計
### 熱儲存
- **Redis**：
  - 資料結構：使用 Sorted Set（key: `trades:<symbol>`，score: timestamp）存放最近 1~5 分鐘資料。
  - 索引策略：利用 score 自然排序，搭配 secondary hash 存放彙總指標。
  - TTL：最近 10 分鐘自動過期。
- **TimescaleDB**：
  - hypertable `trades_realtime`（time, symbol, price, volume, bid_ask_delta）。
  - 分割策略：以時間（1 分鐘 chunk）+ symbol hash 分區。
  - 索引：`(symbol, time DESC)` B-Tree；`time` BRIN 供範圍查詢。

### 冷儲存
- **ClickHouse**（或 PostgreSQL）
  - Table `trades_history`，使用 MergeTree 引擎，Partition by `toYYYYMMDD(time)`，Order by `(symbol, time)`。
  - 物化視圖將 `agg1s`、`agg1m` 資料寫入對應的匯總表（`trades_agg_1s`, `trades_agg_1m`）。
  - 建立二級索引（data skipping index）在 `symbol`、`time` 上加速查詢。

## 4. 資料保留策略與排程清理
- **Redis**：採用 key TTL，自動維持短期資料；定時執行 `ZREMRANGEBYSCORE` 移除過舊資料。
- **TimescaleDB**：使用內建 `drop_chunks`，保留最近 30 天資料，透過 cron job 或 TimescaleDB Policy 每小時執行。
- **ClickHouse/PostgreSQL**：
  - Partition TTL（例如保留 5 年）並透過 `ALTER TABLE ... DROP PARTITION` 排程清理。
  - 使用 `OPTIMIZE TABLE` 排程減少碎片，控制儲存成本。
- **備份與歸檔**：
  - 將過期資料匯出至物件儲存（S3）作為長期備份。
  - 每日增量備份、每週全備份，並定期演練恢復流程。

## 系統排程與可靠性
- **排程工具**：Airflow 或自建 Cronjob，管理資料清理、備份、健康檢查。
- **監控**：
  - Kafka Consumer Lag、Redis 佔用、TimescaleDB/ClickHouse 延遲。
  - 設定告警（Slack/Email），確保資料管線穩定。
- **擴展性**：Topic Partition/Consumer Group 可水平擴充；儲存節點可透過 Sharding 與複寫支援高可用。

