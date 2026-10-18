import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { listLabs, SAMPLE_PAYLOADS } from '@urano/guard-demo-shared';

export type Observation = 'ALLOW' | 'PROTECTED' | 'MONITOR' | 'UNKNOWN' | 'ERROR';
export interface ResponseSample { status: number; body: any; ms: number }
/** HTTP success alone cannot prove that a detector ran. Never retain response bodies. */
export function observe(sample: ResponseSample): Observation {
    if (sample.status >= 500 || sample.status === 408 || sample.status === 429) return 'ERROR';
    const body = sample.body || {}, guard = body.guard || body.decision || body;
    const verdict = String(guard.action || guard.verdict || body.verdict || '').toUpperCase();
    if (sample.status === 401 || sample.status === 404) return 'ERROR';
    if (verdict === 'MONITOR') return 'MONITOR';
    if (['BLOCK','DENY','QUARANTINE','HONEYPOT','DECEIVE','DECEPTION','REDIRECT'].includes(verdict)
        || guard.allowed === false || sample.status === 403
        || typeof body.sessionId === 'string' && body.sessionId.startsWith('ht_')
        || body.status === 'query_success' && body.traceId || body.status === 'redirect_scheduled') return 'PROTECTED';
    if (verdict === 'ALLOW' || guard.allowed === true) return 'ALLOW';
    return 'UNKNOWN';
}
const CASES = [
    { id: 'support', title: 'Soporte cotidiano', category: 'Control benigno', expected: 'ALLOW', body: { message: 'How do I change my notification preferences?' } },
    { id: 'spanish', title: 'Consulta en español', category: 'Control benigno', expected: 'ALLOW', body: { message: 'Resume las ventajas de recibir un resumen semanal de actividad.' } },
    { id: 'quoted', title: 'Lenguaje de seguridad', category: 'Falso positivo', expected: 'ALLOW', body: { message: 'Explain what SQL injection means without providing executable examples.' } },
    { id: 'jailbreak', title: 'Override de fixture', category: 'Detección', expected: 'PROTECTED', body: SAMPLE_PAYLOADS.jailbreak },
    { id: 'sqli', title: 'Cadena SQL de fixture', category: 'Detección', expected: 'PROTECTED', body: SAMPLE_PAYLOADS.sqli },
    { id: 'padding', title: 'Fixture con relleno', category: 'Detección', expected: 'PROTECTED', body: SAMPLE_PAYLOADS.padding },
];
export const SUITES = [
    { id: 'smoke', title: 'Contrato básico', description: 'Un control benigno y una señal de protección.', cases: ['support','jailbreak'] },
    { id: 'false-positive', title: 'Falsos positivos', description: 'Soporte, español y vocabulario de seguridad legítimo.', cases: ['support','spanish','quoted'] },
    { id: 'coverage', title: 'Cobertura de fixtures', description: 'Seis comprobaciones con controles benignos y cadenas del catálogo existente.', cases: CASES.map(item => item.id) },
];
export interface EvaluationRow { id: string; labId: string; caseId: string; title: string; expected: string; observed: Observation; outcome: 'pass'|'fail'|'unknown'|'error'; status?: number; ms?: number; error?: string }
export interface EvaluationRun { id: string; at: string; suiteId: string; state: 'running'|'completed'|'cancelled'; total: number; rows: EvaluationRow[]; context: any; baselineId?: string }
export function summarize(rows: EvaluationRow[]) {
    const times = rows.map(row => row.ms).filter((x): x is number => Number.isFinite(x)).sort((a,b) => a-b);
    return { pass: rows.filter(r => r.outcome === 'pass').length, fail: rows.filter(r => r.outcome === 'fail').length,
        unknown: rows.filter(r => r.outcome === 'unknown').length, error: rows.filter(r => r.outcome === 'error').length,
        p50: times.length ? times[Math.ceil(times.length * .5)-1] : null, p95: times.length ? times[Math.ceil(times.length * .95)-1] : null };
}
export function compare(current: EvaluationRun, baseline?: EvaluationRun) {
    if (!baseline) return [];
    return current.rows.map(row => {
        const prior = baseline.rows.find(item => item.labId === row.labId && item.caseId === row.caseId);
        return { labId: row.labId, caseId: row.caseId, before: prior?.outcome, after: row.outcome,
            regression: prior?.outcome === 'pass' && row.outcome === 'fail',
            unavailable: prior?.outcome === 'pass' && ['unknown','error'].includes(row.outcome),
            deltaMs: prior?.ms != null && row.ms != null ? row.ms - prior.ms : null };
    });
}
export class EvaluationLab {
    readonly runs = new Map<string, EvaluationRun>();
    private abort?: AbortController;
    constructor(private options: { port: number; context: () => any; fire: (lab: any, body: any, signal: AbortSignal) => Promise<ResponseSample> }) {}
    catalog() { return { suites: SUITES, cases: CASES.map(({body, ...item}) => item) }; }
    view(run: EvaluationRun) { return { ...run, summary: summarize(run.rows), comparisons: compare(run, this.runs.get(run.baselineId || '')) }; }
    start(suiteId: string, labIds: string[], baselineId?: string) {
        const fail = (code: string, status = 400): never => { throw Object.assign(new Error(code), { code, status }); };
        if ([...this.runs.values()].some(run => run.state === 'running')) fail('evaluation_busy', 409);
        const suite = SUITES.find(item => item.id === suiteId); if (!suite) fail('unknown_suite');
        const labs = listLabs(this.options.port);
        if (!Array.isArray(labIds) || !labIds.length || labIds.length > 7 || new Set(labIds).size !== labIds.length || labIds.some(id => !labs.some(lab => lab.id === id))) fail('invalid_labs');
        if (suite!.cases.length * labIds.length > 24) fail('maximum_24_cases');
        const baseline = baselineId ? this.runs.get(baselineId) : undefined;
        if (baselineId && (!baseline || baseline.state !== 'completed' || baseline.suiteId !== suiteId)) fail('invalid_baseline');
        if (this.runs.size >= 20) {
            const oldest = [...this.runs.keys()].find(id => id !== baselineId); if (oldest) this.runs.delete(oldest);
        }
        const run: EvaluationRun = { id: randomUUID(), at: new Date().toISOString(), suiteId, state: 'running', total: suite!.cases.length * labIds.length, rows: [], context: this.options.context(), baselineId };
        this.runs.set(run.id, run); const controller = new AbortController(); this.abort = controller;
        void (async () => {
            for (const labId of labIds) for (const caseId of suite!.cases) {
                if (controller.signal.aborted) { run.state = 'cancelled'; return; }
                const item = CASES.find(item => item.id === caseId)!;
                const lab = labs.find(lab => lab.id === labId)!;
                // Payments lab uses monitor_only; this is an observation contract, not a blocking guarantee.
                const expected = labId === '03' && item.expected === 'PROTECTED' ? 'OBSERVE' : item.expected;
                const row: EvaluationRow = { id: randomUUID(), labId, caseId, title: item.title, expected, observed: 'UNKNOWN', outcome: 'unknown' };
                try {
                    const sample = await this.options.fire(lab, item.body, controller.signal);
                    if (controller.signal.aborted) { run.state = 'cancelled'; return; }
                    row.status = sample.status; row.ms = sample.ms; row.observed = observe(sample);
                    row.outcome = row.observed === 'ERROR' ? 'error' : row.observed === 'UNKNOWN' ? 'unknown'
                        : expected === 'OBSERVE' ? (['MONITOR','PROTECTED'].includes(row.observed) ? 'pass' : 'fail') : row.observed === expected ? 'pass' : 'fail';
                } catch { if (controller.signal.aborted) { run.state = 'cancelled'; return; } row.observed = 'ERROR'; row.outcome = 'error'; row.error = 'lab_unreachable_or_timeout'; }
                run.rows.push(row);
            }
            run.state = 'completed';
        })().catch(() => { run.state = 'cancelled'; });
        return this.view(run);
    }
    mount(app: Express) {
        const handler = (fn: any) => (req: any, res: any) => {
            const origin = req.get('origin');
            if (origin && ![`${req.protocol}://${req.get('host')}`, 'http://localhost:5173','http://127.0.0.1:5173'].includes(origin)) { res.status(403).json({error:'cross_origin_not_allowed'}); return; }
            try { fn(req,res); } catch (err: any) { res.status(err.status || 500).json({error:err.code || 'evaluation_failed'}); }
        };
        app.get('/api/evaluations', handler((_req: any,res: any) => res.json({ ...this.catalog(), runs: [...this.runs.values()].reverse().map(run => this.view(run)) })));
        app.post('/api/evaluations', handler((req: any,res: any) => res.status(202).json(this.start(req.body?.suiteId, req.body?.labIds, req.body?.baselineId))));
        app.post('/api/evaluations/:id/cancel', handler((req: any,res: any) => {
            const run = this.runs.get(req.params.id); if (!run) { res.status(404).json({error:'run_not_found'}); return; }
            if (run.state === 'running') { this.abort?.abort(); run.state = 'cancelled'; } res.json(this.view(run));
        }));
    }
}
