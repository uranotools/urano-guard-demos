# Demo 03 — Payments webhook (`monitor_only` E2E)

`POST /webhooks/payments` **always** reaches the app (`securityMode: monitor_only`). Guard still scores via Desktop; audit lines hit `/siem/ingest`. Reports live in Desktop, not in this process.

```bash
set PORT=3003
npm run start:03

curl -s -X POST http://127.0.0.1:3003/webhooks/payments -H "Content-Type: application/json" -d "{\"type\":\"payment_intent.succeeded\",\"data\":{\"object\":{\"id\":\"pi_demo\",\"amount\":5000}}}"
```

Default agente: `http://127.0.0.1:6274/v1/webhook/mcp_cyber-gateway/default`
