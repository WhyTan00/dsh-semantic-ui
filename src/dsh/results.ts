import{randomUUID}from'node:crypto';
import type{Context}from'@deepseek-ai/cordis';
import{defineDomain}from'@deepseek-ai/dsh-storage-domain';
import{clientRequestSchema}from'@deepseek-ai/dsh-client-connection';
import{profileDomainName}from'./library';
import{resultsSchema,emptyResults,ResultLibrary}from'../results';
export const RESULTS_ENDPOINT='dsh-semantic-ui/results';
export function mountResults(ctx:Context){
 ctx.inject(['storageDomain','connection','webServer','profileContext'],async child=>{
  const domain=await child.storageDomain.open(defineDomain({name:profileDomainName(child.profileContext.name)+'_results',version:1,global:{schema:resultsSchema,initial:emptyResults()},tables:{}}));
  child.effect(()=>()=>domain.close());const library=new ResultLibrary(domain.global,randomUUID);
  child.connection.fetch.register({path:'/api/'+RESULTS_ENDPOINT,methods:['POST'],requestBody:'buffered',fetch:async request=>{
   if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return new Response('Expected JSON',{status:415});
   const text=await request.text();if(new TextEncoder().encode(text).length>140000)return new Response('Result request too large',{status:413});
   let raw;try{raw=JSON.parse(text);}catch{return new Response('Invalid JSON',{status:400});}
   const parsed=clientRequestSchema.safeParse(raw);if(!parsed.success||parsed.data.method!==RESULTS_ENDPOINT)return new Response('Invalid request envelope',{status:400});
   const {rpcId,payload}=parsed.data;
   try{request.signal.throwIfAborted();return Response.json({type:'server-response',rpcId,result:{ok:true,value:await library.request(payload)}});}
   catch(e){return Response.json({type:'server-response',rpcId,result:{ok:false,error:{code:'RESULT',message:e instanceof Error?e.message:'Result request failed',details:{}}}});}
  }});
 });
}
