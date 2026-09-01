# Demo 02 — NEED + body

Guard pide `body` en `onRequest`. El primer hop a cyber-gateway va **sin body**; el plugin responde `NEED` inmediato. El segundo hop manda el body y espera al agente (`waitForAgent`).

Un proxy local (`:8791`) registra cada hop antes de Desktop.

```bash
cd urano-guard-demos
npm run start:02

curl -s -X POST http://127.0.0.1:3002/api/ingest -H "Content-Type: application/json" -d "{\"message\":\"hello from NEED demo\"}"
curl -s http://127.0.0.1:3002/hops
```

Consola esperada:

```
[hop 1] followUp=false hasBody=false status=200 verdict=NEED
[hop 2] followUp=true hasBody=true status=200 verdict=ALLOW
```

Default agente:

```
http://127.0.0.1:6274/v1/webhook/mcp_cyber-gateway/default
```

`AGENT_URL=stub` demuestra el mismo NEED contra el stub de :8787.
