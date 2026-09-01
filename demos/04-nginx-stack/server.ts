import express from 'express';
import {
    attachSiemAndHealth,
    createDemoGuard,
    createDemoState,
    pushLog,
    resolveAgentUrl
} from '@urano/guard-demo-shared';

const port = Number(process.env.PORT || 3004);
const state = createDemoState();
const agent = resolveAgentUrl();
const guard = createDemoGuard({
    state,
    appName: 'nginx-edge',
    onEvent: (name) => pushLog(state, name)
});

const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
attachSiemAndHealth(app, state);

app.post('/api/ingest', guard.express(), (req, res) => {
    res.json({ ok: true, via: 'nginx-or-direct', ip: req.ip, body: req.body });
});

app.listen(port, async () => {
    await guard.ready();
    console.log(`App behind nginx (or direct) http://127.0.0.1:${port}`);
    console.log(agent.usingStub ? 'AGENT_URL=stub' : `remoteAgent.url=${agent.url}`);
});
