# Demo 01 — Live control plane

Express API + SSE dashboard. Guard hops to Desktop cyber-gateway (`/default`) unless `AGENT_URL=stub`.

```bash
cd urano-guard-demos
npm install
# Desktop open, cyber-gateway linked, TARGET_AGENT set
set AGENT_TIMEOUT_MS=35000
npm run start:01
```

Default URL: `http://127.0.0.1:6274/v1/webhook/mcp_cyber-gateway/default`

If Vault has `INCOMING_WEBHOOK_SECRET`: `set AGENT_TOKEN=…` (or `AGENT_HMAC`).

Open http://127.0.0.1:3000 — send benign / jailbreak payloads. Blocked IPs and rotated key suffix show on the right. SOC narrative lives in Urano Desktop.
