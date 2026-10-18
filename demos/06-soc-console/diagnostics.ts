export async function inspectWebhook(rawUrl: string, usingStub: boolean, http: typeof fetch = fetch) {
    const at = new Date().toISOString(), started = Date.now();
    if (usingStub || rawUrl === 'stub') return { at, state: 'stub', ready: false, message: 'Stub local: permite probar Guard; no ofrece protocolo v1 para los experimentos de agentes.', transports: [] };
    try {
        const url = new URL(rawUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid_url');
        url.searchParams.delete('mode'); url.searchParams.delete('payload');
        const response = await http(url, { signal: AbortSignal.timeout(4000), redirect: 'error' });
        if (!response.ok) return { at, ready: false, state: 'http_error', status: response.status, message: 'El descubrimiento del webhook devolvió un error HTTP.', transports: [] };
        const data = await response.json() as any;
        const ready = data.protocolVersion === 1 && Array.isArray(data.transports);
        return { at, ready, state: ready ? 'ready' : 'outdated', ms: Date.now()-started,
            protocolVersion: data.protocolVersion ?? null,
            transports: Array.isArray(data.transports) ? data.transports.filter((x: any) => ['async','wait','sse','ws'].includes(x)) : [],
            capabilities: Array.isArray(data.capabilities) ? data.capabilities.filter((x: any) => ['idempotency','turn-status','event-replay','cancel'].includes(x)) : [],
            message: ready ? 'El core anuncia protocolo v1. El descubrimiento no verifica credenciales, modelo ni tools.' : 'Webhook accesible con core anterior: compila y reinicia Urano Desktop por completo. Reiniciar el hub o el plugin no recarga el core.' };
    } catch { return { at, state: 'unreachable', ready: false, ms: Date.now()-started, message: 'No se pudo leer el descubrimiento. Comprueba la URL, el proceso de Urano y el puerto.', transports: [] }; }
}
