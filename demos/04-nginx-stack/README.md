# Demo 04 — Nginx + app + Guard

Local (no Docker). Default agente Desktop `/default`:

```bash
set PORT=3004
npm run start:04
curl -s -X POST http://127.0.0.1:3004/api/ingest -H "Content-Type: application/json" -d "{\"message\":\"hello\"}"
```

Docker (nginx :8080 → app :3004). Desktop must be reachable as `host.docker.internal`:

```bash
cd demos/04-nginx-stack
docker compose up
curl -s -X POST http://127.0.0.1:8080/api/ingest -H "Content-Type: application/json" -d "{\"message\":\"hello\"}"
```

Compose already defaults `AGENT_URL` to `http://host.docker.internal:6274/v1/webhook/mcp_cyber-gateway/default`.

Guard stays in the Node process. Nginx is only the reverse proxy.
