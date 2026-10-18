import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { EvaluationLab, observe, compare, summarize } from '../demos/06-soc-console/evaluationLab';
import { inspectWebhook } from '../demos/06-soc-console/diagnostics';
import { decisionMetadata } from '../packages/shared/decisionMetadata';

async function finished(lab: EvaluationLab, id: string) {
    const deadline = Date.now()+2000;
    while (lab.runs.get(id)?.state === 'running' && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,5));
    assert.notEqual(lab.runs.get(id)?.state, 'running');
    return lab.view(lab.runs.get(id)!);
}
test('observation does not confuse HTTP delivery with a decision', () => {
    assert.equal(observe({status:500,body:{verdict:'BLOCK'},ms:1}), 'ERROR');
    assert.equal(observe({status:200,body:{ok:true},ms:1}), 'UNKNOWN');
    assert.equal(observe({status:200,body:{sessionId:'ht_fixture'},ms:1}), 'PROTECTED');
    assert.equal(observe({status:200,body:{decision:{verdict:'ALLOW'}},ms:1}), 'ALLOW');
    assert.equal(observe({status:200,body:{guard:{action:'MONITOR'}},ms:1}), 'MONITOR');
    assert.equal(observe({status:403,body:{},ms:1}), 'PROTECTED');
    assert.equal(observe({status:401,body:{},ms:1}), 'ERROR');
});
test('sequential evaluation, expectation mismatches, baselines and metadata projection', async () => {
    let active=0, maximum=0, regression=false;
    const lab = new EvaluationLab({port:3010,context:()=>({usingStub:true}),fire:async (_lab,body)=>{
        active++;maximum=Math.max(maximum,active); await new Promise(resolve=>setTimeout(resolve,5));active--;
        const threat=body===undefined?false:JSON.stringify(body).includes('Ignore previous');
        return {status:200,ms:threat?12:4,body:{verdict:threat&&!regression?'BLOCK':'ALLOW',rawBody:'SECRET_BODY',Authorization:'SECRET_TOKEN'}};
    }});
    const a=lab.start('smoke',['hub']);assert.throws(()=>lab.start('smoke',['hub']),/evaluation_busy/);
    const base=await finished(lab,a.id);assert.equal(base.summary.pass,2);assert.equal(maximum,1);
    regression=true;const next=await finished(lab,lab.start('smoke',['hub'],a.id).id);
    assert.equal(next.summary.fail,1);assert.equal(next.comparisons.filter(x=>x.regression).length,1);
    assert.ok(!JSON.stringify(next).includes('SECRET_'));
    assert.equal(summarize(next.rows).p95,12);
    assert.throws(()=>lab.start('coverage',['hub','00','01','02','03']),/maximum_24_cases/);
    assert.throws(()=>lab.start('smoke',['http://untrusted.invalid']),/invalid_labs/);
    assert.throws(()=>lab.start('smoke',['hub','hub']),/invalid_labs/);
    assert.equal(compare(next,{...base,rows:[]})[0].before,undefined);
});
test('cancelling a suite stops pending cases and a later suite cannot cancel another run', async () => {
    let calls=0;
    const lab=new EvaluationLab({port:3010,context:()=>({}),fire:async(_lab,_body,signal)=>{
        calls++; await new Promise<void>(resolve=>{signal.addEventListener('abort',()=>resolve(),{once:true});});
        return {status:200,ms:1,body:{verdict:'ALLOW'}};
    }});
    const app=express();app.use(express.json());lab.mount(app);
    const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${(server.address() as any).port}`;
    try{
        const run=lab.start('smoke',['hub']);
        const rejected=await fetch(base+'/api/evaluations',{method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(rejected.status,403);
        await fetch(base+`/api/evaluations/${run.id}/cancel`,{method:'POST'});
        await finished(lab,run.id);assert.equal(calls,1);assert.equal(lab.runs.get(run.id)?.state,'cancelled');
        assert.equal(lab.runs.get(run.id)?.rows.length,0);
        const next=lab.start('smoke',['hub']);
        await fetch(base+`/api/evaluations/${run.id}/cancel`,{method:'POST'});
        assert.equal(lab.runs.get(next.id)?.state,'running');
        await fetch(base+`/api/evaluations/${next.id}/cancel`,{method:'POST'});
        await finished(lab,next.id);assert.equal(calls,2);
    }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('discovery diagnoses an old running core without inference or secrets', async () => {
    let requests=0;
    const http=(async (url:any,options:any)=>{requests++;assert.ok(!String(url).includes('payload'));assert.ok(!options.body);return new Response(JSON.stringify({ok:true,transports:['wait','sse']}),{headers:{'Content-Type':'application/json'}});}) as typeof fetch;
    const old=await inspectWebhook('http://localhost:6274/v1/webhook/test?mode=wait&payload=secret',false,http);
    assert.equal(old.state,'outdated');assert.equal(old.ready,false);
    assert.equal((await inspectWebhook('stub',true,http)).state,'stub');assert.equal(requests,1);
    const ready=await inspectWebhook('http://localhost:6274/test',false,(async()=>new Response(JSON.stringify({protocolVersion:1,transports:['sse','ws','secret'],capabilities:['cancel']}))) as typeof fetch);
    assert.equal(ready.ready,true);assert.deepEqual(ready.transports,['sse','ws']);
    assert.equal((await inspectWebhook('http://user:password@localhost/test',false,http)).state,'unreachable');
});
test('additive lab response exposes only decision metadata',()=>{
    const result=decisionMetadata({action:'MONITOR',allowed:true,riskScore:50,agentAnalysis:'SECRET_ANALYSIS',rawBody:'SECRET_BODY',source:'fixture'});
    assert.equal(result.action,'MONITOR');assert.ok(!JSON.stringify(result).includes('SECRET_'));
});
