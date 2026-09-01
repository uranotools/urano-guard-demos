# Demo 05 — Fail-open / fail-closed

Measures infrastructure failure of the agent hop (Desktop down, timeout, invalid JSON).

Stub (does **not** call Desktop). `AGENT_URL=stub` is required:

```bash
# Invalid JSON from stub (historic "OK" text) + fail-open: request still allowed by local WAF
set AGENT_URL=stub
set STUB_MODE=badjson
set FAIL_POLICY=open
set PORT=3005
npm run start:05

curl -s -X POST http://127.0.0.1:3005/api/ingest -H "Content-Type: application/json" -d "{\"message\":\"hello\"}"
```

```bash
# Slow stub exceeds timeout + fail-closed: blocked
set AGENT_URL=stub
set STUB_MODE=slow
set FAIL_POLICY=closed
set AGENT_TIMEOUT_MS=400
npm run start:05
```

```bash
# STUB_MODE=down starts no stub; Guard runs local-only
set AGENT_URL=stub
set STUB_MODE=down
set FAIL_POLICY=closed
```

Desktop down (default URL, then quit Urano Desktop):

```bash
set FAIL_POLICY=closed
npm run start:05
```

Default URL if you omit `AGENT_URL`:

```
http://127.0.0.1:6274/v1/webhook/mcp_cyber-gateway/default
```
