import express from 'express';
import {
    attachSiemAndHealth,
    createDemoGuard,
    createDemoState,
    pushLog,
    resolveAgentUrl
} from '@urano/guard-demo-shared';

const port = Number(process.env.PORT || 3005);
const state = createDemoState();
const agent = resolveAgentUrl();
const failClosed = process.env.FAIL_POLICY === 'closed';

const guard = createDemoGuard({
    state,
    appName: 'resilience',
    failClosed,
    timeoutMs: Number(process.env.AGENT_TIMEOUT_MS || 1500),
    onEvent: (name, data) => pushLog(state, `${name} ${data?.decision?.source || ''}`)
});

const app = express();
app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
attachSiemAndHealth(app, state);

app.post('/api/ingest', guard.express(), (req, res) => {
    res.json({ ok: true, failClosed, stub: agent.usingStub, body: req.body });
});

app.listen(port, async () => {
    await guard.ready();
    console.log(`Resilience demo http://127.0.0.1:${port}`);
    console.log(`FAIL_POLICY=${failClosed ? 'closed' : 'open'} STUB_MODE=${process.env.STUB_MODE || 'ok'} agent=${agent.usingStub ? 'stub' : agent.url}`);
});
