# BillionaireBron0 Platform

Early scaffold for the "DeepSeek R1 AI Asset Sniffing Hound" mobile + server system derived from DIY Custom Strategy Builder logic.

## Components

- `server/`: Node.js Express + WebSocket + prototype SignalEngine translating bar data into watch/actionable events following JSON contract.
- `mobile/`: (planned) React Native app consuming stream & offering configuration + (future) broker trade execution.
- `shared/`: Placeholder for shared schemas & types.

## Running Server

Install deps and start dev server:

```bash
cd server
npm install
npm run dev
```

POST bars (example):

```bash
curl -X POST http://localhost:4000/ingest/bar \
  -H 'Content-Type: application/json' \
  -d '{"symbol":"BTCUSD","time":"2025-08-21T14:05:00Z","open":100,"high":110,"low":95,"close":108,"volume":12345}'
```

Open a WebSocket client to `ws://localhost:4000/stream` to receive events.

Update config:

```bash
curl -X POST http://localhost:4000/config -H 'Content-Type: application/json' -d '{"leadingIndicator":"MACD","confirmationsEnabled":["EMA200","RSI"],"signalExpiryCandles":4}'
```

## Event Schema (Prototype)

- watchOpportunity
- actionableSignal
- expiredSetup
- cancelledSetup

## Plans (Free vs Pro)

Free (login-free):

- Real-time WebSocket events (single engine basics)
- Range Filter / MACD leading (simplified)
- Basic confirmations (EMA200, MACD, RSI)
- Signal detail (limited risk view gated)
- Simulation script

Pro ($19.99):

- Supertrend leading & confirmation
- Multi-symbol management & crypto polling
- SQLite persistence & historical API `/signals/recent`
- Broker integration (Alpaca paper trading endpoints)
- AI enrichment endpoint (DeepSeek stub) per symbol
- Trend intelligence module & export reports
- Free/Pro export script
- Planned: competitor intelligence, sentiment ingestion, advanced risk, backtesting

Upgrade Path: expose in mobile app UI with gating; risk & broker actions require Pro.

## Roadmap Additions

- Competitor intelligence (integrations placeholders)
- Topic trend ingestion (Google Trends bridging via external service)
- Sentiment (news + social API adapters)
- Backtesting harness & performance metrics
- Encrypted credential vault
- Push notifications & alert rules engine

## Disclaimer

Prototype only. Indicators partly simplified. Not production-ready. No trading advice.
