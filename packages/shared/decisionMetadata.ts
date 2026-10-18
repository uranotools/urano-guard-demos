/** Additive demo contract, deliberately excludes analysis, arguments and bodies. */
export function decisionMetadata(decision: any) {
    if (!decision) return { verdict: 'UNKNOWN' };
    return { action: decision.action, allowed: typeof decision.allowed === 'boolean' ? decision.allowed : undefined,
        riskScore: typeof decision.riskScore === 'number' && Number.isFinite(decision.riskScore) ? decision.riskScore : undefined,
        source: typeof decision.source === 'string' ? decision.source.slice(0,120) : undefined };
}
