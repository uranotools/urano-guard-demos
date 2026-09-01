import express from 'express';
import {
    attachSiemAndHealth,
    createDemoGuard,
    createDemoState,
    pushLog,
    resolveAgentUrl
} from '@urano/guard-demo-shared';

const port = Number(process.env.PORT || 3003);
const state = createDemoState();
const agent = resolveAgentUrl();
const ledger = [
    { id: 'pay_1', amount: 1200, ip: '203.0.113.9', status: 'paid' },
    { id: 'pay_2', amount: 40, ip: '198.51.100.2', status: 'paid' }
];

const guard = createDemoGuard({
    state,
    appName: 'payments',
    securityMode: 'monitor_only',
    onEvent: (name) => pushLog(state, name)
});

const app = express();
app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
attachSiemAndHealth(app, state);

app.post('/webhooks/payments', guard.express(), (req, res) => {
    const evt = req.body || {};
    ledger.unshift({
        id: evt.data?.object?.id || `pay_${Date.now()}`,
        amount: evt.data?.object?.amount || 0,
        ip: req.ip,
        status: 'received'
    });
    pushLog(state, `payment ${evt.type || 'event'} accepted (monitor_only)`);
    res.json({ received: true, type: evt.type || 'unknown', ledgerSize: ledger.length });
});

app.get('/ledger', (_req, res) => res.json(ledger.slice(0, 20)));

app.listen(port, async () => {
    await guard.ready();
    console.log(`Payments webhook http://127.0.0.1:${port}/webhooks/payments`);
    console.log(agent.usingStub ? 'AGENT_URL=stub' : `remoteAgent.url=${agent.url}`);
});
