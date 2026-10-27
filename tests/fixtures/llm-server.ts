import {createServer} from 'node:http';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {architecture,chart,distribution,largeArchitecture} from '../../fixtures/examples';
import {currentGroundingFixtures,declaredDecision,consistencyFixtures} from '../../fixtures/consistency';
import {signedComparison} from '../../fixtures/chart-comparison';
import {qualityFixtures} from '../../fixtures/quality';
import {sharedPaths} from '../../fixtures/grounding';
const output=process.env.FIXTURE_OUTPUT_DIR!;mkdirSync(output,{recursive:true});let seq=0;
const server=createServer(async(req,res)=>{
 if(req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({object:'list',data:[{id:'semantic-fixture',object:'model',owned_by:'local-deterministic-fixture'}]}));return;}
 let body='';for await(const c of req)body+=c;
 const request=JSON.parse(body);const n=++seq;const hostSourceCase=process.env.SOURCE_HOST_CASE_FILE?JSON.parse(readFileSync(process.env.SOURCE_HOST_CASE_FILE,'utf8')):undefined;
 writeFileSync(`${output}/${hostSourceCase?hostSourceCase.key+'-':''}${n}.json`,JSON.stringify(request,null,2));
 const userText=JSON.stringify(request.messages.filter((m:any)=>m.role==='user'));
 const which=[...userText.matchAll(/Semantic fixture (architecture|decision|chart|histogram)/g)].at(-1)?.[1]??'architecture';const quality=[...userText.matchAll(/QUALITY_FIXTURE=(irregular|bars|missing|prebinned|graph)/g)].at(-1)?.[1] as keyof typeof qualityFixtures|undefined;const grounding=[...userText.matchAll(/GROUNDING_FIXTURE=(capacity|paths|proposal|capability|resource|scope)/g)].at(-1)?.[1];const view=userText.includes('COMPARISON_FIXTURE')?signedComparison:grounding?(grounding==='paths'?sharedPaths:currentGroundingFixtures[grounding as keyof typeof currentGroundingFixtures]):quality?qualityFixtures[quality]:userText.includes('ARCHITECTURE_SCALE')?largeArchitecture:which.includes('decision')?declaredDecision:which.includes('histogram')?distribution:which.includes('chart')?chart:architecture;
 const fillers=[...JSON.stringify(request.messages.filter((m:any)=>m.role==='user')).matchAll(/HISTORY_FILLER_(\d+)/g)];
 const currentSourceAt=hostSourceCase?.sourceText?request.messages.findLastIndex((m:any)=>m.role==='user'&&JSON.stringify(m.content).includes(hostSourceCase.sourceText)):-1;
 const last=request.messages.at(-1),toolCount=request.messages.slice(currentSourceAt<0?0:currentSourceAt+1).filter((m:any)=>m.role==='tool').length;const done=last?.role==='tool'&&(!hostSourceCase?.argsSequence||toolCount>=hostSourceCase.argsSequence.length);const toolNames=request.tools?.map((t:any)=>t.function?.name)??[];
 // The host appends user-role reminders after the real prompt; choose the
 // latest explicit test marker across user messages, never a system prompt.
 const semanticAt=userText.lastIndexOf('Semantic fixture '),legacyAt=userText.lastIndexOf('GENUI_HISTORY'),probeAt=userText.lastIndexOf('GUIDANCE_PROBE');
 const legacy=legacyAt>=0&&legacyAt>Math.max(semanticAt,probeAt);
 const probe=probeAt>=0&&probeAt>Math.max(semanticAt,legacyAt);
 const ptc=toolNames.includes('run_code')&&!toolNames.includes('dsh_semantic_ui');
 const snapshot=[...userText.matchAll(/PROTOCOL_(?:CHART_)?HISTORY=(1\.[0123])/g)].at(-1)?.[1];
 const target=snapshot?'semantic_history_fixture':'dsh_semantic_ui';
 const name=ptc?'run_code':target;
 const reuse=[...userText.matchAll(/TEMPLATE_REUSE=([a-f0-9-]+):(\d+)/g)].at(-1);
 const consistency=[...userText.matchAll(/CONSISTENCY_FIXTURE=(resource|scope|bad-role|bad-effect)/g)].at(-1)?.[1];const current=consistency?structuredClone(consistencyFixtures[consistency==='bad-role'?'resource':consistency==='bad-effect'?'scope':consistency]):view;if(consistency==='bad-role'&&current.component==='DecisionExplorer')current.payload.requirements![1].relation='supports';if(consistency==='bad-effect'&&current.component==='DecisionExplorer')current.payload.inputs[1].expectedEffect='hard';
 const fresh=structuredClone(current);if(reuse&&fresh.component==='DataChart'&&fresh.payload.chartType!=='histogram'){fresh.payload.title='Fresh template sensor readings';fresh.summary='New measurements; statistics are recalculated from this dataset.';fresh.payload.rows.forEach((row,i)=>{row.values.a=100*(i+1);});}
 const semanticArgs=hostSourceCase?(hostSourceCase.argsSequence?.[toolCount]??hostSourceCase.args):snapshot?{version:snapshot,...(userText.includes('PROTOCOL_CHART_HISTORY')?{component:'DataChart'}:{})}:{action:userText.includes('CHECK_ONLY')?'check':'render',view:reuse?fresh:current,...(reuse?{templateId:reuse[1],templateVersion:Number(reuse[2])}:{})};
 const args=ptc?{description:'Deterministic semantic host fixture',code:`const result = await tools.${target}(${JSON.stringify(semanticArgs)}); console.log(JSON.stringify(result));`}:semanticArgs;
 const base={id:`fixture-${n}`,object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:'semantic-fixture'};
 res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
 const send=(delta:any,finish_reason:any=null)=>res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta,finish_reason}]})+'\n\n');
 if(hostSourceCase&&done){send({role:'assistant',content:'Local host source fixture '+hostSourceCase.key+' completed. This is deterministic transport, not a model acceptance result.'});send({},'stop');}
 else if(legacy){send({role:'assistant',content:'Legacy fixture record.\n\n```dsh-ui\n'+JSON.stringify({title:'Historical status',items:[{type:'stat',label:'Fictional deliveries',value:'7'},{type:'text',content:'Legacy renderer still owns this saved message.'}]})+'\n```'});send({},'stop');}
 else if(probe){send({role:'assistant',content:'Generation probe finished.'});send({},'stop');}
 else if(fillers.length){send({role:'assistant',content:'History filler '+fillers.at(-1)![1]+' complete.'});send({},'stop');}
 else if(done){send({role:'assistant',content:consistency?.startsWith('bad-')?'Deterministic rejection completed. No component was delivered.':'Deterministic fixture completed. The component above is persisted by the semantic UI plugin.'});send({},'stop');}
 else {await delay(Number(process.env.FIXTURE_DELAY_MS??0));send({role:'assistant',tool_calls:[{index:0,id:`call-${n}`,type:'function',function:{name,arguments:JSON.stringify(args)}}]});send({},'tool_calls');}
 res.write('data: [DONE]\n\n');res.end();
});server.listen(Number(process.env.FIXTURE_PORT),'127.0.0.1',()=>console.log('Deterministic fixture endpoint ready on the assigned loopback port (not a model).'));
