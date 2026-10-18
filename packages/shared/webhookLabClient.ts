import { createHmac, randomUUID } from 'node:crypto';

export interface ProtocolConfig { url: string; token?: string; hmac?: string; timeoutMs?: number }
export interface ExecutionIds { turnId?: string; sessionId?: string; requestId?: string; lastEventId?: string }
export interface HopResult extends ExecutionIds { status: number; body?: any; detached?: boolean; events: any[] }
export interface HopOptions {
    mode?: 'wait' | 'async' | 'sse' | 'ws'; key?: string; signal?: AbortSignal; after?: string;
    onMeta?: (ids: ExecutionIds) => void; onEvent?: (event: any) => boolean | void;
}
export class ProtocolError extends Error {
    constructor(public code: string, public status = 502) { super(code); }
}

/** Incremental SSE decoder: handles split UTF-8/CRLF and bounds individual frames. */
export class SseDecoder {
    private pending = '';
    feed(chunk: string): any[] {
        this.pending += chunk;
        if (this.pending.length > 2 * 1024 * 1024) throw new ProtocolError('event_frame_too_large');
        const events: any[] = [];
        let boundary: RegExpExecArray | null;
        while ((boundary = /\r?\n\r?\n/.exec(this.pending))) {
            const frame = this.pending.slice(0, boundary.index);
            this.pending = this.pending.slice(boundary.index + boundary[0].length);
            const lines = frame.split(/\r?\n/);
            const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
            if (!data) continue;
            let event: any;
            try { event = JSON.parse(data); } catch { throw new ProtocolError('invalid_sse_json'); }
            if (!event || typeof event !== 'object' || Array.isArray(event)) throw new ProtocolError('invalid_sse_event');
            const id = lines.find(line => line.startsWith('id:'))?.slice(3).trim();
            if (id && !event.id) event.id = id;
            events.push(event);
        }
        return events;
    }
}

export class WebhookLabClient {
    constructor(private config: ProtocolConfig, private http: typeof fetch = fetch) {}
    private headers(raw: string, options: HopOptions = {}) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Urano-Protocol-Version': '1' };
        if (this.config.hmac) headers['x-urano-signature'] = 'sha256=' + createHmac('sha256', this.config.hmac).update(raw).digest('hex');
        else if (this.config.token) headers.Authorization = 'Bearer ' + this.config.token;
        if (options.key) headers['Idempotency-Key'] = options.key;
        if (options.after) headers['Last-Event-ID'] = options.after;
        return headers;
    }
    private target() {
        let url: URL;
        try { url = new URL(this.config.url); } catch { throw new ProtocolError('invalid_agent_url', 400); }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new ProtocolError('invalid_agent_url', 400);
        return url;
    }
    async discover() {
        const url = this.target(); url.searchParams.delete('mode'); url.searchParams.delete('payload');
        const response = await this.http(url, { headers: this.headers(''), signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new ProtocolError('discovery_http_' + response.status, response.status);
        let info: any;
        try { info = await response.json(); } catch { throw new ProtocolError('protocol_v1_required', 409); }
        if (info.protocolVersion !== 1 || !Array.isArray(info.transports)) throw new ProtocolError('protocol_v1_required', 409);
        return { protocolVersion: 1, transports: info.transports, capabilities: info.capabilities || [] };
    }
    envelope(task: any, sessionId?: string) {
        return { schemaVersion: '1.0', source: 'urano-guard', requestId: randomUUID(), followUp: true,
            ...(sessionId ? { sessionId } : {}), request: { senderId: 'soc-protocol-lab', ip: '127.0.0.1', method: 'POST', path: '/experiments', body: task },
            extra: { app: 'soc-protocol-lab', synthetic: true } };
    }
    control(turnId: string, action: 'status' | 'events' | 'cancel', options: HopOptions = {}) {
        const payload = { schemaVersion: '1.0', source: 'urano-guard', followUp: true,
            request: { senderId: 'soc-protocol-lab', method: 'POST', path: '/experiments/control' }, webhookAction: action, turnId };
        return this.invoke(payload, { ...options, mode: action === 'events' ? 'sse' : 'wait' });
    }
    async invoke(payload: any, options: HopOptions = {}): Promise<HopResult> {
        if (options.mode === 'ws') return this.socket(payload, options);
        const delivery = new AbortController();
        const abort = () => delivery.abort();
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) abort();
        const timer = setTimeout(abort, Math.min(120000, Math.max(1000, this.config.timeoutMs || 35000)));
        try {
        const url = this.target(); url.searchParams.set('mode', options.mode || 'wait');
        const raw = JSON.stringify(payload);
        const response = await this.http(url, { method: 'POST', headers: this.headers(raw, options), body: raw,
            signal: delivery.signal });
        const result: HopResult = { status: response.status, events: [], turnId: response.headers.get('x-urano-turn-id') || undefined,
            sessionId: response.headers.get('x-urano-session-id') || undefined, requestId: response.headers.get('x-request-id') || undefined };
        options.onMeta?.(result);
        if (response.headers.get('content-type')?.includes('text/event-stream') && response.body) {
            const reader = response.body.getReader(); const decoder = new TextDecoder(); const frames = new SseDecoder();
            try {
                while (true) {
                    const next = await reader.read(); if (next.done) break;
                    for (const event of frames.feed(decoder.decode(next.value, { stream: true }))) {
                        this.accept(result, event, options);
                        if (options.onEvent?.(event) === false) { result.detached = true; return result; }
                    }
                }
            } finally { await reader.cancel().catch(() => {}); }
            if (!result.detached && !result.body) { result.detached = true; result.body = { error: 'stream_closed_before_terminal' }; }
        } else {
            const text = await response.text();
            if (text.length > 2 * 1024 * 1024) throw new ProtocolError('response_too_large');
            try { result.body = JSON.parse(text); } catch { result.body = { acknowledgement: text.slice(0, 80) }; }
            Object.assign(result, { turnId: result.turnId || result.body?.turnId, sessionId: result.sessionId || result.body?.sessionId });
            options.onMeta?.(result);
        }
        if (result.status >= 400) throw Object.assign(new ProtocolError('webhook_http_' + result.status, result.status), { ids: this.ids(result), detail: result.body?.error });
        return result;
        } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
    }
    private ids(result: HopResult): ExecutionIds { return { turnId: result.turnId, sessionId: result.sessionId, requestId: result.requestId, lastEventId: result.lastEventId }; }
    private accept(result: HopResult, event: any, options: HopOptions) {
        if (event.version !== 1) throw new ProtocolError('unsupported_event_version');
        for (const key of ['turnId', 'sessionId', 'requestId'] as const) if (typeof event[key] === 'string') result[key] = event[key];
        if (typeof event.id === 'string') result.lastEventId = event.id;
        // Only a tiny rolling window is needed by the caller; it never becomes an audit log of raw tool arguments.
        result.events.push(event); if (result.events.length > 16) result.events.shift();
        if (event.type === 'done') result.body = { state: 'succeeded', response: event.response, result: event };
        if (event.type === 'error') result.body = { state: event.state, error: event.error, status: event.status };
        options.onMeta?.(this.ids(result));
    }
    private socket(payload: any, options: HopOptions): Promise<HopResult> {
        const Socket = (globalThis as any).WebSocket;
        if (!Socket) return Promise.reject(new ProtocolError('websocket_requires_node_22', 501));
        const url = this.target(); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.pathname = url.pathname.replace(/\/$/, '') + '/ws'; url.searchParams.delete('mode');
        const raw = JSON.stringify(payload);
        return new Promise((resolve, reject) => {
            const ws = new Socket(url.toString()); const result: HopResult = { status: 200, events: [] };
            let settled = false;
            const finish = (error?: Error) => {
                if (settled) return; settled = true; clearTimeout(timer); options.signal?.removeEventListener('abort', abort);
                try { ws.close(); } catch {}
                error ? reject(error) : resolve(result);
            };
            const abort = () => { result.detached = true; finish(); };
            const timer = setTimeout(() => finish(new ProtocolError('websocket_timeout', 504)), Math.min(120000, Math.max(1000, this.config.timeoutMs || 35000)));
            options.signal?.addEventListener('abort', abort, { once: true });
            if (options.signal?.aborted) { abort(); return; }
            ws.addEventListener('open', () => ws.send(JSON.stringify({ payload: raw, headers: this.headers(raw, options) })));
            ws.addEventListener('message', (message: any) => {
                try {
                    if (String(message.data).length > 2 * 1024 * 1024) throw new ProtocolError('event_frame_too_large');
                    const event = JSON.parse(String(message.data));
                    if (!event.version && event.type === 'error') throw new ProtocolError('websocket_rejected', event.status || 502);
                    this.accept(result, event, options);
                    if (options.onEvent?.(event) === false) { result.detached = true; finish(); }
                    else if (event.type === 'done' || event.type === 'error') finish();
                } catch (error) { finish(error as Error); }
            });
            ws.addEventListener('error', () => finish(new ProtocolError('websocket_unavailable', 502)));
            ws.addEventListener('close', () => { if (!settled) finish(new ProtocolError('websocket_closed', 502)); });
        });
    }
}
