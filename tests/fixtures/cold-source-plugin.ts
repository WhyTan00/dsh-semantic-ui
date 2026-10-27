import type {Context} from '@deepseek-ai/cordis';
import type {SessionStore,SessionId} from '@deepseek-ai/dsh-session';
import type {} from '@deepseek-ai/dsh-api-session-controller';
import type {} from '@deepseek-ai/dsh-workspace';
import type {} from '@deepseek-ai/dsh-agent';
export const name='semantic-cold-source-fixture';
export const inject=['connection','sessions','agents','sessionController','workspaceRegistry'];
/** Isolated test observer only. No resolver, prompt, event append or real jobs.
 * Archive/unarchive is used only inside the harness-created private profile. */
export function apply(ctx:Context){
 const busy=new Set<string>(),sessions=ctx.sessions as unknown as SessionStore;
 ctx.on('workspace/session-activity',async({sessionId},next)=>{const rest=await next();return busy.has(sessionId)?[{kind:'turn'},...rest]:rest;});
 ctx.connection.fetch.register({path:'/api/semantic-cold-fixture',methods:['POST'],requestBody:'buffered',async fetch(request){
  const {rpcId,payload:p}=await request.json() as {rpcId:string;payload:{action:string;sessionId:SessionId;busy?:boolean}};
  const observation=await ctx.sessionController.inspect(p.sessionId,request.signal);
  if(p.action==='busy')p.busy?busy.add(p.sessionId):busy.delete(p.sessionId);
  else if(p.action==='archive')await ctx.workspaceRegistry.archiveSession(p.sessionId);
  else if(p.action==='unarchive')await ctx.workspaceRegistry.unarchiveSession(p.sessionId);
  else if(p.action!=='inspect')throw Error('Unknown fixture action');
  const events=observation.events;
  const value={sessionId:p.sessionId,agentLive:!!ctx.agents.get(p.sessionId as any),sessionAttached:!!sessions.get(p.sessionId),headSeq:events.at(-1)?.seq??-1,eventCount:events.length,turnStarts:events.filter(e=>e.type==='turn/start').length,ordinary:observation.meta.origin!=='subagent',archived:ctx.workspaceRegistry.archivedSessionIds.includes(p.sessionId),syntheticBusy:busy.has(p.sessionId)};
  return Response.json({type:'server-response',rpcId,result:{ok:true,value}});
 }});
}
