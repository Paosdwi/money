# Real-time and Availability Requirements

## Real-time Market Data Requirements
- **Update Frequency**: Market tick and order book updates should refresh at least every 250 ms via WebSocket streams. Candlestick aggregates generated every 1 second for high-frequency dashboards and 1 minute for standard views.
- **End-to-End Latency**: From exchange publish time to UI render, 750 ms p95 for tick data; 1.5 s p95 for aggregated metrics. Alert triggers should evaluate within 500 ms of condition detection.
- **Data Freshness Guarantees**: Any processing lag exceeding 2 seconds must raise an operational alert. Automated replay/recovery routines must catch up within 1 minute after transient disconnections.

## Account & Portfolio Requirements
- **Balance Synchronization**: Reconcile account balances every 5 seconds via streaming updates, with REST backfill every 2 minutes or on demand when drift detected.
- **Order Lifecycle**: Acknowledge new orders within 200 ms (internal SLA) after exchange confirmation. Maintain idempotent order submission to avoid duplicates during retries.

## System Availability & Reliability
- **Service Availability**: Target 99.9% uptime for public APIs and dashboard over a rolling 30-day window (<= 43 minutes downtime/month).
- **Data Pipeline Availability**: Ingestion and streaming layers must sustain 99.5% availability with automatic failover (redundant collectors, multi-AZ deployment).
- **Disaster Recovery**: Recovery Time Objective (RTO) 30 minutes; Recovery Point Objective (RPO) < 1 minute using cross-region replication for critical stores.
- **Scalability**: Ability to handle 5x baseline traffic bursts without manual intervention, leveraging auto-scaling groups or Kubernetes HPA.

## Operational Requirements
- **Monitoring & Alerts**: Implement SLO dashboards for latency, error rates, and throughput. PagerDuty on-call notified for p95 latency breaches > 5 minutes.
- **Security**: Enforce secret rotation every 90 days, hardware-backed key storage, and principle of least privilege (exchange API keys scoped to required permissions only).
- **Compliance Logging**: Retain audit logs for at least 1 year to satisfy financial reporting requirements.
