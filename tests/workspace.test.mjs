import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
const bin=process.env.IMPECCABLE_BIN;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'congo native host '));
const env={...process.env,CONGO_WORKSPACE_HOME:path.join(dir,'host'),IMPECCABLE_TELEMETRY_CHANNEL:'test'};
const call=(...args)=>execFileSync(bin,args,{cwd:dir,env,encoding:'utf8'});
let host,key;
async function api(route,body){const url=new URL(host.url);const token=url.hash.slice(1);url.hash='';url.pathname=route;const r=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,value:await r.json()};}
after(async()=>{if(bin){if(key)try{call('serve-question','--stop','--key',key)}catch{}try{call('workspace','stop')}catch{}}await new Promise(r=>setTimeout(r,200));fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
test('direct opening hosts native Choices and reuses one workspace',{skip:!bin},async()=>{
  assert.equal(JSON.parse(call('workspace','--probe')).protocol,1);
  host=JSON.parse(call('workspace','--view','choices','--no-browser'));
  assert.equal(host.state.view,'choices');assert.equal(host.state.agentListening,false);assert.equal(host.state.choicesUrl,null);
  assert.equal(JSON.parse(call('workspace','--no-browser')).pid,host.pid);
  const url=new URL(host.url);url.hash='';const html=await(await fetch(url)).text();assert.match(html,/<iframe id="choices-frame"/);assert.doesNotMatch(html,/candidate-deck|workspace-choice|empty-mark/);
  const native=await(await fetch(new URL('/native-choices',url))).text();assert.match(native,/aria-label="Impeccable"/);assert.match(native,/id="deck"|class="grid"/);assert.match(native,/--ks-kinpaku/);
});
test('the host attaches the original question server and forwards library steering to its original wait',{skip:!bin},async()=>{
  const payload=path.join(dir,'choices.json');fs.writeFileSync(payload,JSON.stringify({title:'Native UI reuse fixture',question:'Protocol fixture, not a customer workflow claim.',followup:true,options:[{id:'one',label:'Original card one',thesis:'Original renderer and controls.'},{id:'two',label:'Original card two',thesis:'Same native workflow.'}]}));
  const started=call('serve-question','--start','--payload',payload,'--workspace',host.url,'--no-open');key=started.match(/QUESTION KEY: (\S+)/)?.[1];const nativeUrl=started.match(/QUESTION URL: (\S+)/)?.[1];assert.ok(key,started);assert.ok(nativeUrl,started);
  assert.equal((await api('/api/status')).value.choicesUrl,nativeUrl);
  const html=await(await fetch(nativeUrl)).text();assert.match(html,/Original card one/);assert.match(html,/card-inner/);assert.match(html,/class="choose"/);
  const child=spawn(bin,['serve-question','--wait','--key',key,'--poll','20'],{cwd:dir,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  const completed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  const deadline=Date.now()+7000;while(Date.now()<deadline){if((await api('/api/status')).value.agentListening)break;await new Promise(r=>setTimeout(r,75));}
  assert.equal((await api('/api/status')).value.agentListening,true);
  await api('/api/view',{view:'live-app'});assert.equal((await api('/api/status')).value.choicesUrl,nativeUrl);await api('/api/view',{view:'choices'});
  const result=await api('/api/try',{item:{id:'reference-fixture',version:'fixture-1',title:'Protocol fixture'}});assert.equal(result.status,200,JSON.stringify(result.value));assert.equal(await completed,0,output);assert.match(output,/"optionId":"reroll"/);assert.match(output,/reference-fixture@fixture-1/);
  assert.equal((await api('/api/status')).value.agentListening,false);
  fs.writeFileSync(payload,JSON.stringify({title:'Follow-up on the same native round',followup:true,options:[{id:'adjusted',label:'Adjusted working direction',thesis:'Normal chat follow-up.'}]}));
  call('serve-question','--update','--key',key,'--payload',payload);
  assert.match(await(await fetch(nativeUrl)).text(),/Adjusted working direction/);
  await api('/api/view',{view:'live-app'});
  call('workspace','stop');
  host=JSON.parse(call('workspace','--no-browser'));
  assert.equal(host.state.view,'live-app');assert.equal(host.state.choicesUrl,nativeUrl);
  assert.match(await(await fetch(nativeUrl)).text(),/Adjusted working direction/);
});
