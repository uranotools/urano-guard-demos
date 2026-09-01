export interface LabDef {
    id: string;
    name: string;
    port: number;
    health: string;
    ingestPath: string;
    ingestMethod: 'POST';
    workspace?: string;
    note?: string;
    self?: boolean;
}

/** Ports the stack (`npm start`) binds. Solo `start:00` sigue usando 3000 si no pasas PORT. */
export const STACK_PORTS = {
    '00': 3006,
    '01': 3000,
    '02': 3002,
    '03': 3003,
    '04': 3004,
    '05': 3005,
    hub: 3010
} as const;

export function listLabs(hubPort = STACK_PORTS.hub): LabDef[] {
    return [
        {
            id: 'hub',
            name: 'SOC console (este proceso)',
            port: hubPort,
            health: '/health',
            ingestPath: '/api/ingest',
            ingestMethod: 'POST',
            workspace: '@urano/demo-06-soc-console',
            self: true
        },
        {
            id: '00',
            name: '00 min contract',
            port: STACK_PORTS['00'],
            health: '/health',
            ingestPath: '/chat',
            ingestMethod: 'POST',
            workspace: '@urano/demo-00-min-contract',
            note: 'En el stack usa :3006. `npm run start:00` solo usa :3000.'
        },
        {
            id: '01',
            name: '01 control plane',
            port: STACK_PORTS['01'],
            health: '/health',
            ingestPath: '/api/ingest',
            ingestMethod: 'POST',
            workspace: '@urano/demo-01-control-plane'
        },
        {
            id: '02',
            name: '02 NEED + body',
            port: STACK_PORTS['02'],
            health: '/health',
            ingestPath: '/api/ingest',
            ingestMethod: 'POST',
            workspace: '@urano/demo-02-need-body'
        },
        {
            id: '03',
            name: '03 payments',
            port: STACK_PORTS['03'],
            health: '/health',
            ingestPath: '/webhooks/payments',
            ingestMethod: 'POST',
            workspace: '@urano/demo-03-payments'
        },
        {
            id: '04',
            name: '04 nginx app',
            port: STACK_PORTS['04'],
            health: '/health',
            ingestPath: '/api/ingest',
            ingestMethod: 'POST',
            workspace: '@urano/demo-04-nginx'
        },
        {
            id: '05',
            name: '05 resilience',
            port: STACK_PORTS['05'],
            health: '/health',
            ingestPath: '/api/ingest',
            ingestMethod: 'POST',
            workspace: '@urano/demo-05-resilience'
        }
    ];
}
