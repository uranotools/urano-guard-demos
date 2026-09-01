import express from 'express';
import {
    createDemoGuard,
    createDemoState,
    resolveAgentUrl,
    summarizeDecision,
    attachSiemAndHealth
} from '@urano/guard-demo-shared';

const port = Number(process.env.PORT || 3000);
const agent = resolveAgentUrl();
const state = createDemoState();
const guard = createDemoGuard({
    state,
    appName: 'min-contract',
    exposeDecisionDetails: true
});

const app = express();
app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
attachSiemAndHealth(app, state);

app.post('/chat', guard.express(), (req: any, res) => {
    const out = summarizeDecision(req.uranoGuard);
    console.log(JSON.stringify(out, null, 2));
    res.json(out);
});

app.listen(port, async () => {
    await guard.ready();
    console.log(`Min contract http://127.0.0.1:${port}/chat`);
    console.log(agent.usingStub ? 'AGENT_URL=stub' : `remoteAgent.url=${agent.url}`);
});
