import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import express from 'express';
import { WebhookLabClient, SseDecoder } from '../packages/shared/webhookLabClient';
import { auditEvent, ProtocolLab } from '../demos/06-soc-console/protocolLab';

async function fixture() {
    const secret = 'fixture-secret-for-tests'; let invocations = 0;
    const turns = new Map<string, any>(), keys = new Map<string, string>();
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url!, 'http://localhost');
        if (req.method === 'GET') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ protocolVersion: 1, transports: ['wait','async','sse','ws'] })); return; }
        let raw = ''; for await (const chunk of req) raw += chunk;
        const valid = req.headers['x-urano-signature'] === 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
        if (!valid) { res.writeHead(403); res.end('{}'); return; }
        const body = JSON.parse(raw);
        let turn: any;
        if (body.webhookAction) {
            turn = turns.get(body.turnId);
            if (!turn) { res.writeHead(404); res.end('{}'); return; }
            if (body.webhookAction === 'cancel') { turn.state = 'cancelled'; turn.events = turn.events.slice(0, -1).concat({ ...turn.events.at(-1), type: 'error', error: 'execution_cancelled', status: 409 }); }
            if (body.webhookAction !== 'events') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(turn)); return; }
        } else {
            const key = String(req.headers['idempotency-key'] || ''); const prior = keys.get(key);
            if (key && prior) {
                turn = turns.get(prior);
                if (turn.raw !== raw) { res.writeHead(409); res.end('{}'); return; }
            } else {
                invocations++; const id = `turn-${invocations}`;
                turn = { turnId: id, sessionId: body.sessionId || `session-${invocations}`, requestId: `request-${invocations}`, raw,
                    state: 'succeeded', result: { response: JSON.stringify({ verdict: 'ALLOW', analysis: 'Polaris-27' }) } };
                turn.events = ['session','TokenStreamChunk','ToolCallStarted','ToolCallCompleted','done'].map((type, index) => ({
                    version: 1, id: `${id}:${index + 1}`, sequence: index + 1, type, turnId: id, sessionId: turn.sessionId, requestId: turn.requestId,
                    ...(type === 'TokenStreamChunk' ? { chunk: 'Hola' } : {}),
                    ...(type === 'ToolCallStarted' ? { toolCall: { name: 'lookup', arguments: { Authorization: 'NEVER_AUDIT' } } } : {}),
                    ...(type === 'done' ? { response: turn.result.response } : {}) }));
                turns.set(id, turn); if (key) keys.set(key, id);
            }
        }
        res.setHeader('X-Urano-Turn-Id', turn.turnId); res.setHeader('X-Urano-Session-Id', turn.sessionId); res.setHeader('X-Request-Id', turn.requestId);
        if (url.searchParams.get('mode') === 'sse' || body.webhookAction === 'events') {
            res.setHeader('Content-Type', 'text/event-stream');
            const after = String(req.headers['last-event-id'] || '');
            const cursor = after ? Number(after.split(':').at(-1)) : 0;
            for (const event of turn.events.filter((item: any) => item.sequence > cursor)) res.write(`id: ${event.id}\r\nevent: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`);
            res.end();
        } else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(url.searchParams.get('mode') === 'async' ? { acknowledgement: 'OK' } : { ...turn.result, execution: { turnId: turn.turnId } })); }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as any).port}/v1/webhook/mcp_cyber-gateway/default`;
    return { url, secret, turns, invocations: () => invocations, close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }) };
}

test('SSE parsing across CRLF and fragmented JSON', () => {
    const decoder = new SseDecoder();
    assert.deepEqual(decoder.feed('id: turn:1\r\ndata: {"type":"ses'), []);
    assert.deepEqual(decoder.feed('sion"}\r\n\r\n'), [{ type: 'session', id: 'turn:1' }]);
    assert.deepEqual(decoder.feed(': keepalive\n\n'), []);
});
test('metadata audit never records request bodies, tool arguments or token content', () => {
    const row = auditEvent({ type: 'ToolCallStarted', turnId: 'turn-1', chunk: 'PRIVATE_BODY', req: { body: 'PRIVATE_BODY' },
        toolCall: { name: 'lookup', arguments: { authorization: 'SECRET_AUTH', cookie: 'SECRET_COOKIE' } }, config: { secret: 'SECRET_CONFIG' } });
    const serialized = JSON.stringify(row);
    for (const secret of ['PRIVATE_BODY','SECRET_AUTH','SECRET_COOKIE','SECRET_CONFIG']) assert.ok(!serialized.includes(secret));
    assert.equal(row.tool, 'lookup'); assert.equal(row.chars, 12);
});
test('signed protocol: duplicate delivery, sessions, detach/replay, controls and wrong credentials', async () => {
    const server = await fixture();
    try {
        const client = new WebhookLabClient({ url: server.url, hmac: server.secret });
        assert.equal((await client.discover()).protocolVersion, 1);
        const payload = client.envelope({ message: 'fixture' });
        const copies = await Promise.all([client.invoke(payload, { key: 'same', mode: 'wait' }), client.invoke(payload, { key: 'same', mode: 'wait' })]);
        assert.equal(copies[0].turnId, copies[1].turnId); assert.equal(server.invocations(), 1);
        await assert.rejects(client.invoke(client.envelope({ message: 'changed' }), { key: 'same' }), /webhook_http_409/);
        const next = await client.invoke(client.envelope({ message: 'followup' }, copies[0].sessionId), { mode: 'sse' });
        assert.equal(next.sessionId, copies[0].sessionId); assert.notEqual(next.turnId, copies[0].turnId);
        const detached = await client.invoke(client.envelope({ message: 'resume' }), { mode: 'sse', onEvent: () => false });
        assert.ok(detached.detached); assert.ok(detached.lastEventId);
        const replay = await client.control(detached.turnId!, 'events', { after: detached.lastEventId });
        assert.ok(replay.events.some(event => event.type === 'done')); assert.ok(!replay.events.some(event => event.type === 'session'));
        const status = await client.control(detached.turnId!, 'status'); assert.equal(status.body.state, 'succeeded');
        const cancel = await client.control(detached.turnId!, 'cancel'); assert.equal(cancel.body.state, 'cancelled');
        await assert.rejects(new WebhookLabClient({ url: server.url, hmac: 'wrong' }).invoke(payload), /webhook_http_403/);
    } finally { await server.close(); }
});
test('SOC experiment routes: registry, asynchronous run and same-origin restriction', async () => {
    const upstream = await fixture(); const app = express(); app.use(express.json());
    const lab = new ProtocolLab(() => ({ url: upstream.url, hmac: upstream.secret })); lab.mount(app);
    const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    try {
        const snapshot: any = await (await fetch(base + '/api/experiments')).json(); assert.equal(snapshot.scenarios.length, 8);
        const blocked = await fetch(base + '/api/experiments', { headers: { Origin: 'https://untrusted.invalid' } }); assert.equal(blocked.status, 403);
        const started = await fetch(base + '/api/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 'idempotency', transport: 'sse' }) });
        assert.equal(started.status, 202); const run: any = await started.json();
        const until = Date.now() + 2500;
        while (!lab.runs.get(run.id)?.checks.length && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(upstream.invocations(), 1);
        assert.ok(lab.runs.get(run.id)?.checks.every(check => check.passed));
        assert.ok(!JSON.stringify(lab.snapshot()).includes('NEVER_AUDIT'));
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await upstream.close(); }
});
test('cyber-gateway: authenticated controls do not become NEED or invoke the model', async () => {
    const pluginPath = process.env.CYBER_GATEWAY_PATH || path.resolve(process.cwd(), '../UranoDesktop-plugins/cyber-gateway');
    const { ChannelPlugin } = await import(pathToFileURL(path.join(pluginPath, 'Plugins/Channel/ChannelPlugin.ts')).href);
    const plugin = new ChannelPlugin({ INCOMING_WEBHOOK_SECRET: 'fixture-secret' });
    const body = { schemaVersion: '1.0', source: 'urano-guard', webhookAction: 'status', turnId: 'turn-1', request: { senderId: 'soc-protocol-lab' }, capabilities: { canDisclose: ['body'] } };
    const rawBody = JSON.stringify(body);
    const req = { body, rawBody, query: {}, url: 'http://localhost', headers: { 'x-urano-signature': 'sha256=' + createHmac('sha256', 'fixture-secret').update(rawBody).digest('hex') } };
    assert.equal(await plugin.executeAction('validateWebhook', { req }), true);
    const parsed = await plugin.executeAction('parseWebhook', { req });
    assert.equal(parsed.from, 'soc-protocol-lab'); assert.equal(parsed.text, ''); assert.equal(parsed.immediateResponse, undefined);
    assert.equal(await plugin.executeAction('validateWebhook', { req: { ...req, rawBody: rawBody + ' ' } }), false);
    assert.equal(await new ChannelPlugin({ REQUIRE_WEBHOOK_AUTH: true }).executeAction('validateWebhook', { req }), false);
    const formatted = await plugin.executeAction('formatWebhookResponse', { agentResponse: '{"verdict":"ALLOW"}', turnId: 'turn-1', sessionId: 'session-1', requestId: 'request-1' });
    assert.equal(formatted.body.verdict, 'ALLOW'); assert.equal(formatted.body.execution.turnId, 'turn-1');
});
