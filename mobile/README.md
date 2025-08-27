# BillionairBron0 Mobile App (Scaffold)

React Native / Expo (to be added) client will:
- Connect WebSocket `wss://<host>/stream` for real-time events.
- Display watch opportunities & actionable signals.
- Allow configuration (leading indicator, confirmations, expiry) via REST `/config`.
- Support brokerage API credential storage (NOT IMPLEMENTED YET) with secure storage.

Planned screens:
1. Dashboard (live signals list, filter by symbol, side, status).
2. Signal Detail (rationale, confirmations, risk snapshot, quick trade buttons).
3. Trade Ticket (size, stop, take-profit; send to broker via future integration layer).
4. News & Calendar (placeholder: integrate vendor API / RSS aggregator).
5. Settings (indicators, API keys, theme, notification preferences).

Next steps:
- Initialize Expo project.
- Implement WebSocket client & local caching.
- Add mock symbol selector and bar ingestion (until live market data wired).
