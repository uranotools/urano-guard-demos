import express from 'express';
import {
    attachSiemAndHealth,
    createDemoGuard,
    createDemoState,
    pushLog,
    resolveAgentUrl,
    startHopForwarder,
    summarizeDecision
} from '@urano/guard-demo-shared';

const port = Number(process.env.PORT || 3002);
const state = createDemoState();
const agent = resolveAgentUrl();
const target = agent.url || 'http://127.0.0.1:8787';
const forwarder = startHopForwarder(target, {
    onHop: (hop) => pushLog(state, `hop ${hop.hop} verdict=${hop.verdict} hasBody=${hop.hasBody}`)
});

const guard = createDemoGuard({
    state,
    appName: 'need-body',
    agentUrl: forwarder.url,
    exposeDecisionDetails: true,
    onEvent: (name) => pushLog(state, name)
});

const app = express();
app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
attachSiemAndHealth(app, state);

app.get('/hops', (_req, res) => res.json(forwarder.hops));

app.post('/api/ingest', guard.express(), (req: any, res) => {
    res.json({
        ok: true,
        decision: summarizeDecision(req.uranoGuard),
        hops: forwarder.hops
    });
});

app.listen(port, async () => {
    await guard.ready();
    console.log(`NEED+body http://127.0.0.1:${port}/api/ingest`);
    console.log(`hop logger ${forwarder.url} → ${target}${agent.usingStub ? ' (stub)' : ''}`);
    console.log('POST a body; hop 1 omits body (NEED), hop 2 sends body to Desktop.');
});
