# AGENTS.md — Urano Guard demos

Instructions for humans and AI coding agents contributing to this repo.

**ES:** Ejemplos + consola SOC. Lee esto antes de añadir una demo o tocar el hub. El SDK está en [`../urano-guard`](../urano-guard) (`AGENTS.md` de allá para inspectores).

**EN:** Demo apps + SOC console. Read this before adding a lab. SDK rules live in urano-guard’s AGENTS.md.

---

## What this is

npm workspaces. Each `demos/NN-*` is a tiny Express app with `createDemoGuard()`. Demo **06** is the Vue hub (`:3010`). `npm start` runs 00–06 via `concurrently`.

Remote agent default:

`http://127.0.0.1:6274/v1/webhook/mcp_cyber-gateway/default`

## What this is not

Do not market as CDN WAF, SIEM, or multi-tenant SOC. No login. Charts are session RAM. HTTP 200 on jailbreak is often the **honeypot**.

Do **not** add exploit PoCs, malware, or attack procedures. Fixtures are detection strings only (see existing `SAMPLE_PAYLOADS`).

---

## Repo map

```
packages/shared/     createDemoGuard, SAMPLE_PAYLOADS, listLabs()
packages/shared/labs.ts   THE registry — hub Labs page + /api/attacks/fire
demos/00-min-contract     smallest ingest (copy this)
demos/01-live-control-plane
demos/02-need-body
demos/03-payments-webhook   monitor_only
demos/04-nginx-stack
demos/05-resilience
demos/06-soc-console
  server.ts                 hub API (SSE, settings, fire, soc/chat, reports)
  frontend/src/modules/soc/pages/   Vue pages — do not hardcode lab ports here
```

Public humans: [README.md](README.md).

---

## Add a demo (vibecoder checklist)

Takes minutes if you copy 00. **Do not invent a new inspector** here; that belongs in `urano-guard`.

1. Copy `demos/00-min-contract` → `demos/07-your-name`.
2. `package.json` `"name": "@urano/demo-07-your-name"`, `"start": "tsx server.ts"`.
3. Server **must**:
   - `const port = Number(process.env.PORT || 3007)`
   - `attachSiemAndHealth(app, state)` → `GET /health`
   - `createDemoGuard({ state, appName: 'your-name' })`
   - Guard middleware **only** on the traffic route, never on `/health`
4. Root [`package.json`](package.json):
   - `"workspaces"` += `"demos/07-your-name"`
   - `"start:07": "npm run start -w @urano/demo-07-your-name"`
   - `start:stack`: add `-n` label `07` and `"npm run start:07"`
5. [`packages/shared/labs.ts`](packages/shared/labs.ts): `STACK_PORTS['07']` + one object in `listLabs()` (`id`, `port`, `health`, `ingestPath`, `workspace`).
6. `npm install` at repo root, `npm start`. Labs card must go **up**. Fire Benigno and Jailbreak from the hub.

Ingest contract: JSON POST. The hub forwards `/api/payloads` bodies. Another shape is fine (see 03 payments) as long as it is POST JSON.

Port clash: 00 and 01 both default to 3000. Stack forces 00 to **3006** (`cross-env PORT=3006`). Pick a free port for 07+.

### Minimal `server.ts`

```ts
import express from 'express';
import {
    attachSiemAndHealth,
    createDemoGuard,
    createDemoState,
    resolveAgentUrl
} from '@urano/guard-demo-shared';

const port = Number(process.env.PORT || 3007);
const state = createDemoState();
const agent = resolveAgentUrl();
const guard = createDemoGuard({ state, appName: 'your-name' });
const app = express();
app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); } }));
attachSiemAndHealth(app, state);
app.post('/api/ingest', guard.express(), (req, res) => {
    res.json({ ok: true, received: req.body });
});
app.listen(port, async () => {
    await guard.ready();
    console.log(`your-name http://127.0.0.1:${port}`);
    console.log(agent.usingStub ? 'stub' : agent.url);
});
```

Vue: **no new page required**. The hub reads `listLabs()`.

---

## Other contributions

| Want | Where |
|---|---|
| New attack button | `ATTACK_CATALOG` in `demos/06-soc-console/server.ts` + optional `SAMPLE_PAYLOADS` in shared. Detection strings only. |
| Overview / Live UI | `demos/06-soc-console/frontend/src/modules/soc/pages/` |
| Guard settings at runtime | hub `PUT /api/settings` recreates Guard; persist `data/settings.json` (gitignored) |
| Detection rule | **urano-guard** inspectors + corpus fixtures, not this repo |
| Desktop webhook / SOC prompt | `UranoDesktop-plugins/cyber-gateway/` |

Overview ring: hub Guard events plus **proxy** rows when you fire at another lab (`inferRemoteDecision`). Each lab still has its own Guard.

SOC chat: `POST /api/soc/chat` → schema 1.0 **direct** to `agentUrl`. Do not wrap it in `guard.express()`.

---

## Hard rules

1. Empty runtime extras on the SDK; this demo repo may depend on Express / Vue / Chart.js.
2. No ReDoS in any regex you add on a hot path.
3. Do not log bodies, cookies, or `Authorization` in examples.
4. Do not bump versions or invent 1.3 / 1.4 for Guard from here.
5. Honest docs: if you add a feature, say what it is **and** is not.
6. `demos/06-soc-console/data/*.json` is local state — do not commit secrets.

---

## Commands

Node ≥ 18.

```bash
npm install
npm start                 # stack 00–06, UI :3010
npm run start:06          # hub only
npm run dev:06            # Vite :5173 + API :3010
npm run start:03          # one lab
```

After a hub `server.ts` change, restart the stack (tsx does not hot-reload). After a Vue change: `npm run build -w @urano/demo-06-soc-console` or `dev:06`.
