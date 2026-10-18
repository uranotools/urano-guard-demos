import { randomUUID } from 'node:crypto';
import type { Express, Response } from 'express';
import { WebhookLabClient, ProtocolConfig, ExecutionIds, HopResult, ProtocolError } from '../../packages/shared/webhookLabClient';
import { PROTOCOL_SCENARIOS } from '../../packages/shared/protocolScenarios';

type Transport = 'wait' | 'sse' | 'ws';
interface AuditRow { id: string; at: string; type: string; sequence?: number; turnId?: string; tool?: string; chars?: number; state?: string; error?: string }
interface LabRun extends ExecutionIds {
    id: string; scenarioId: string; title: string; transport: Transport; state: string; at: string; updatedAt: string;
    checks: Array<{ label: string; passed: boolean; detail?: string }>; events: AuditRow[]; result?: any; error?: string;
}
interface PrivateRun { payload: any; key: string; client: WebhookLabClient; controller?: AbortController; seen: Set<string>; active: boolean }
const safeLabel = (value: any) => typeof value === 'string' ? value.slice(0, 160).replace(/[^\w .:\/-]/g, '_') : undefined;
/** Allowlist only: tool args, request bodies, token chunks and credentials never enter the audit ring. */
export function auditEvent(event: any): AuditRow {
    return { id: typeof event.id === 'string' ? event.id : randomUUID(), at: new Date().toISOString(),
        type: safeLabel(event.type) || 'unknown', sequence: Number.isSafeInteger(event.sequence) ? event.sequence : undefined,
        turnId: safeLabel(event.turnId), tool: safeLabel(event.toolName || event.toolCall?.name),
        chars: typeof event.chunk === 'string' ? event.chunk.length : undefined,
        state: safeLabel(event.state), error: safeLabel(event.error) };
}

export class ProtocolLab {
    readonly runs = new Map<string, LabRun>();
    private privateRuns = new Map<string, PrivateRun>();
    private subscribers = new Set<Response>();
    constructor(private config: () => ProtocolConfig) {}
    catalog() { return PROTOCOL_SCENARIOS.map(({ task, ...scenario }) => scenario); }
    snapshot() { return { scenarios: this.catalog(), runs: [...this.runs.values()].reverse().map(run => this.publicRun(run)) }; }
    private publicRun(run: LabRun) { return { ...run, events: run.events.slice(-100) }; }
    private publish(type: string, data: any) {
        const frame = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const response of this.subscribers) {
            if (response.destroyed || response.writableLength > 512 * 1024) { response.end(); this.subscribers.delete(response); continue; }
            try { response.write(frame); } catch { this.subscribers.delete(response); response.destroy(); }
        }
    }
    private update(run: LabRun, state?: string) {
        if (state) run.state = state;
        run.updatedAt = new Date().toISOString();
        const { events, ...summary } = run; this.publish('run', summary);
    }
    private check(run: LabRun, label: string, passed: boolean, detail?: string) { run.checks.push({ label, passed, detail }); this.update(run); }
    private callbacks(run: LabRun, record: PrivateRun, stopAfterFirst = false) {
        let received = 0;
        return {
            onMeta: (ids: ExecutionIds) => {
                let changed = false;
                if (ids.turnId && run.turnId && ids.turnId !== run.turnId) run.lastEventId = undefined;
                for (const key of ['turnId', 'sessionId', 'requestId', 'lastEventId'] as const) if (ids[key] && run[key] !== ids[key]) { run[key] = ids[key]; changed = true; }
                if (changed && !run.events.length) this.update(run);
            },
            onEvent: (event: any) => {
                if (event.id && record.seen.has(event.id)) return;
                if (event.id) { record.seen.add(event.id); if (record.seen.size > 2048) record.seen.delete(record.seen.values().next().value!); }
                const row = auditEvent(event); run.events.push(row); if (run.events.length > 500) run.events.shift();
                this.publish('audit', { runId: run.id, row, ids: { turnId: run.turnId, sessionId: run.sessionId, requestId: run.requestId, lastEventId: run.lastEventId } });
                received++;
                if (stopAfterFirst && received === 1) return false;
            }
        };
    }
    private boundedResult(value: any): any {
        // Analysis is a separate RAM-only result view, never a body/credential audit log.
        if (value == null) return undefined;
        const config = this.config();
        const allowed = ['state','error','status','verdict','riskScore','reason','analysis','report','response','execution','metrics','deliveryError','cancelRequested'];
        const projection = typeof value === 'object' ? Object.fromEntries(allowed.filter(key => key in value).map(key => [key, value[key]])) : value;
        if (typeof value?.result === 'object') projection.result = { response: value.result.response, agentId: value.result.agentId, toolsUsed: value.result.toolsUsed };
        let text = typeof projection === 'string' ? projection : JSON.stringify(projection);
        for (const secret of [config.token, config.hmac]) if (secret && secret.length >= 4) text = text.split(secret).join('[redacted]');
        text = text.replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]');
        return text.slice(0, 16000);
    }
    private absorb(run: LabRun, result: HopResult) {
        for (const key of ['turnId', 'sessionId', 'requestId', 'lastEventId'] as const) if (result[key]) run[key] = result[key];
        run.result = this.boundedResult(result.body);
        const state = result.body?.error === 'agent_timeout' ? 'delivery_timeout' : result.body?.error === 'execution_cancelled' ? 'cancelled' : result.detached ? 'detached' : result.body?.state || (result.detached ? 'detached' : result.body?.error ? 'error' : result.body?.acknowledgement ? 'running' : 'succeeded');
        this.update(run, state);
    }
    start(scenarioId: string, transport: Transport, sessionId?: string) {
        const scenario = PROTOCOL_SCENARIOS.find(item => item.id === scenarioId);
        if (!scenario) throw new ProtocolError('unknown_scenario', 400);
        if (!['wait', 'sse', 'ws'].includes(transport)) throw new ProtocolError('invalid_transport', 400);
        if ([...this.privateRuns.values()].filter(run => run.active).length >= 4) throw new ProtocolError('lab_busy', 429);
        if (this.runs.size >= 50) {
            const oldest = [...this.runs.keys()].find(id => !this.privateRuns.get(id)?.active);
            if (!oldest) throw new ProtocolError('lab_busy', 429);
            this.runs.delete(oldest); this.privateRuns.delete(oldest);
        }
        const client = new WebhookLabClient(this.config()); const id = randomUUID();
        const run: LabRun = { id, scenarioId, title: scenario.title, transport, state: 'starting', at: new Date().toISOString(), updatedAt: new Date().toISOString(), checks: [], events: [] };
        const record: PrivateRun = { payload: client.envelope(scenario.task, sessionId), key: `lab-${id}`, client, seen: new Set(), active: true };
        this.runs.set(id, run); this.privateRuns.set(id, record); this.update(run);
        void this.execute(run, record, scenario.mechanism).catch(error => this.fail(run, error)).finally(() => { record.active = false; });
        return this.publicRun(run);
    }
    private async execute(run: LabRun, record: PrivateRun, mechanism: string) {
        const discovery = await record.client.discover();
        if (['reconnect', 'cancel'].includes(mechanism)) run.transport = 'sse';
        if (!discovery.transports.includes(run.transport)) throw new ProtocolError('transport_not_enabled', 409);
        record.controller = new AbortController(); this.update(run, 'running');
        const options = { mode: run.transport, key: record.key, signal: record.controller.signal, ...this.callbacks(run, record) };
        if (mechanism === 'idempotency') {
            const results = await Promise.all([record.client.invoke(record.payload, options), record.client.invoke(record.payload, options)]);
            this.absorb(run, results[0]);
            this.check(run, 'Las entregas comparten turnId', !!results[0].turnId && results[0].turnId === results[1].turnId);
        } else if (mechanism === 'continuity') {
            const first = await record.client.invoke(record.payload, options); this.absorb(run, first);
            if (!first.sessionId || first.body?.error) throw new ProtocolError('first_turn_incomplete', 409);
            const next = record.client.envelope({ kind: 'workflow-lab', message: '¿Qué identificador te pedí recordar? Devuélvelo en analysis sin ejecutar acciones.' }, first.sessionId);
            record.payload = next; record.key += '-followup';
            const result = await record.client.invoke(next, { ...options, key: record.key }); this.absorb(run, result);
            this.check(run, 'Misma sesión, distinto turno', result.sessionId === first.sessionId && !!result.turnId && result.turnId !== first.turnId);
            this.check(run, 'El resultado menciona el dato recordado', JSON.stringify(result.body).includes('Polaris-27'), 'Depende de la respuesta del modelo; no equivale a una garantía de memoria.');
        } else if (mechanism === 'reconnect') {
            const first = await record.client.invoke(record.payload, { ...options, mode: 'sse', ...this.callbacks(run, record, true) }); this.absorb(run, first);
            if (!first.turnId || !first.lastEventId) throw new ProtocolError('cursor_not_received', 409);
            const cursor = first.lastEventId;
            this.check(run, 'Stream cerrado sin cancelar el turno', first.detached === true);
            const recovered = await record.client.control(first.turnId, 'events', { signal: record.controller.signal, after: cursor, ...this.callbacks(run, record) }); this.absorb(run, recovered);
            this.check(run, 'Retomado con el mismo turnId', recovered.turnId === first.turnId);
        } else if (mechanism === 'cancel') {
            const first = await record.client.invoke(record.payload, { ...options, mode: 'async' }); this.absorb(run, first);
            if (!first.turnId) throw new ProtocolError('turn_not_received', 409);
            const result = await record.client.control(first.turnId, 'cancel'); this.absorb(run, result);
            this.check(run, 'Cancelación aceptada o turno ya finalizado', result.status === 202 || ['succeeded', 'failed', 'cancelled'].includes(result.body?.state));
            if (result.status === 202) this.absorb(run, await record.client.control(first.turnId, 'events', { ...this.callbacks(run, record), signal: record.controller.signal }));
        } else {
            this.absorb(run, await record.client.invoke(record.payload, options));
        }
        this.check(run, 'Identidad de ejecución recibida', !!run.turnId && !!run.requestId);
    }
    private fail(run: LabRun, error: any) {
        if (error?.ids) for (const key of ['turnId', 'sessionId', 'requestId'] as const) if (error.ids[key]) run[key] = error.ids[key];
        run.error = safeLabel(error instanceof ProtocolError ? error.code : error?.name === 'AbortError' ? 'delivery_detached' : 'lab_request_failed');
        this.update(run, error?.name === 'AbortError' ? 'detached' : 'error');
    }
    action(id: string, action: string) {
        const run = this.runs.get(id), record = this.privateRuns.get(id);
        if (!run || !record) throw new ProtocolError('run_not_found', 404);
        if (!['detach', 'resume', 'status', 'cancel', 'retry'].includes(action)) throw new ProtocolError('invalid_action', 400);
        if (action === 'detach') { record.controller?.abort(); this.update(run, 'detached'); return this.publicRun(run); }
        if (record.active && !['status', 'cancel'].includes(action)) throw new ProtocolError('run_busy', 409);
        if (action !== 'retry' && !run.turnId) throw new ProtocolError('turn_not_received', 409);
        const controller = new AbortController();
        if (['resume', 'retry'].includes(action)) { record.active = true; record.controller = controller; }
        void (async () => {
            let result: HopResult;
            if (action === 'retry') result = await record.client.invoke(record.payload, { mode: run.transport, key: record.key, signal: controller.signal, ...this.callbacks(run, record) });
            else result = await record.client.control(run.turnId!, action === 'resume' ? 'events' : action as 'status' | 'cancel', { after: action === 'resume' ? run.lastEventId : undefined, signal: controller.signal, ...this.callbacks(run, record) });
            this.absorb(run, result);
        })().catch(error => this.fail(run, error)).finally(() => { if (['resume', 'retry'].includes(action)) record.active = false; });
        return this.publicRun(run);
    }
    mount(app: Express) {
        const handle = (fn: (req: any, res: Response) => any) => (req: any, res: Response) => {
            const origin = req.get('origin');
            if (origin && ![`${req.protocol}://${req.get('host')}`, 'http://127.0.0.1:5173', 'http://localhost:5173'].includes(origin)) { res.status(403).json({ error: 'cross_origin_not_allowed' }); return; }
            try { Promise.resolve(fn(req, res)).catch(error => res.status(error.status || 502).json({ error: error.code || 'lab_request_failed' })); }
            catch (error: any) { res.status(error.status || 502).json({ error: error.code || 'lab_request_failed' }); }
        };
        app.get('/api/experiments', handle((_req, res) => res.json(this.snapshot())));
        app.post('/api/experiments', handle((req, res) => {
            const sessionId = req.body?.sessionId;
            if (sessionId && (typeof sessionId !== 'string' || sessionId.length > 256 || !/^[\w-]+$/.test(sessionId))) throw new ProtocolError('invalid_session_id', 400);
            res.status(202).json(this.start(String(req.body?.scenarioId), req.body?.transport || 'sse', sessionId));
        }));
        app.post('/api/experiments/:id/:action', handle((req, res) => res.status(202).json(this.action(req.params.id, req.params.action))));
        app.get('/api/experiments/events', handle((req, res) => {
            res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-store'); res.flushHeaders?.();
            res.write(`event: snapshot\ndata: ${JSON.stringify(this.snapshot())}\n\n`); this.subscribers.add(res);
            const timer = setInterval(() => { if (!res.destroyed) res.write(': keepalive\n\n'); }, 15000);
            req.on('close', () => { clearInterval(timer); this.subscribers.delete(res); });
        }));
    }
}
