# SOC console (demo 06)

La consola Vue está en esta carpeta (`server.ts` + `frontend/`).

```
npm start
```

en la **raíz** de `urano-guard-demos` levanta 00–06. Solo este hub: `npm run start:06`.

Dev (API :3010 + Vite :5173):

```
npm run dev -w @urano/demo-06-soc-console
```

Abre http://127.0.0.1:5173 (dev) o http://127.0.0.1:3010 (start).

## Qué es

- Overview con gráficas del ring de **esta sesión** (veredictos, risk, categorías).
- Ataques simulados (fixtures: benign, jailbreak, SQLi, padding, XSS, prompt).
- Live SSE (timeline, logs, SIEM local, IPs bloqueadas).
- SOC chat: POST schema 1.0 **directo** al agente (no pasa por `guard.inspect()`).
- Reportes en `data/reports.json`.
- Labs: health de 00–06 (registro en `packages/shared/labs.ts`; `npm start` las levanta).
- Settings: cambiar `AGENT_URL` (Desktop, Cloud `/t/{tenantId}`, o `stub`) y recrear Guard.

## Qué no es

- No es un SIEM ni un WAF de CDN.
- No hay usuarios ni roles.
- `server.blockIp` solo afecta el ThreatRegistry **de este proceso**.
- Las gráficas se pierden al matar el proceso.
- El modelo y la API key son los del agente en Urano Desktop (Vault), no de este demo.

Cómo aportar una demo nueva: ver [AGENTS.md](../../AGENTS.md) en la raíz del monorepo.

Desktop es **opcional**. Camino Urano: [uranoai.com/workspace](https://uranoai.com/workspace) → plugin **cyber-gateway** → LLM → agente (`TARGET_AGENT`). O apunta `AGENT_URL` a **tu** webhook schema 1.0: [CUSTOM_AGENT.md](https://github.com/uranotools/urano-guard/blob/main/CUSTOM_AGENT.md). Paso a paso: [README raíz](../../README.md#arranque). Timeout típico de un hop LLM: ~20s (tope 35s).
