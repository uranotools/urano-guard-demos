import express from 'express';
import {
    SAMPLE_PAYLOADS,
    attachSiemAndHealth,
    createDemoGuard,
    createDemoState,
    publicState,
    pushLog,
    resolveAgentUrl
} from '@urano/guard-demo-shared';

const port = Number(process.env.PORT || 3000);
const state = createDemoState();
const agent = resolveAgentUrl();
const sseClients = new Set<express.Response>();

function broadcast(name: string, data: any) {
    const payload = `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) res.write(payload);
}

const guard = createDemoGuard({
    state,
    appName: 'control-plane',
    onEvent: (name, data) => {
        const safe = sanitize(name, data);
        pushLog(state, `${name}`);
        broadcast(name, safe);
        broadcast('state', publicState(state));
    }
});

function sanitize(name: string, data: any) {
    if (name === 'requestBlocked' || name === 'requestAllowed') {
        const d = data?.decision || {};
        return {
            allowed: d.allowed,
            action: d.action,
            riskScore: d.riskScore,
            reason: d.reason,
            source: d.source,
            investigationPending: d.investigationPending,
            analysis: d.agentAnalysis,
            reportTitle: d.agentReport?.title
        };
    }
    if (name === 'threatDetected') {
        return { category: data?.threat?.category, summary: data?.threat?.summary, score: data?.threat?.riskScore };
    }
    return data;
}

const app = express();
app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
app.use(express.static(__dirname + '/public'));
attachSiemAndHealth(app, state);

app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: hello\ndata: ${JSON.stringify({ usingStub: agent.usingStub, agentUrl: agent.url })}\n\n`);
    res.write(`event: state\ndata: ${JSON.stringify(publicState(state))}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
});

app.get('/state', (_req, res) => res.json({ ...publicState(state), usingStub: agent.usingStub }));

app.post('/api/ingest', guard.express(), (req, res) => {
    if (req.header('x-api-key') && req.header('x-api-key') !== state.apiKey) {
        res.status(401).json({ error: 'bad api key (rotated by agent skill)' });
        return;
    }
    pushLog(state, `ingest ${req.ip} ${JSON.stringify(req.body).slice(0, 80)}`);
    res.json({ ok: true, received: req.body, server: publicState(state) });
});

app.get('/payloads', (_req, res) => res.json(SAMPLE_PAYLOADS));

app.listen(port, async () => {
    await guard.ready();
    console.log(`Control plane http://127.0.0.1:${port}`);
    console.log(agent.usingStub
        ? 'AGENT_URL=stub — local rules stub'
        : `remoteAgent.url=${agent.url}`);
});
