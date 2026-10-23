import {randomUUID,createHash} from 'node:crypto';
import type {Context} from '@deepseek-ai/cordis';
import {defineDomain} from '@deepseek-ai/dsh-storage-domain';
import {clientRequestSchema} from '@deepseek-ai/dsh-client-connection';
import type {} from '@deepseek-ai/dsh-app-boot';
import {TemplateLibrary,librarySchema,emptyLibrary} from '../templates';

// The host's default storage backend is HOME-wide, not profile-local. Scope
// our domain by the launcher's stable profile name without storing its path.
export const profileDomainName=(name:string)=>'dsh_semantic_ui_'+createHash('sha256').update(name).digest('hex').slice(0,24);
export const LIBRARY_ENDPOINT='dsh-semantic-ui/library';

/** Uses Connection's native envelope; authentication belongs to the carrier. */
export async function libraryResponse(library:TemplateLibrary,request:Request):Promise<Response>{
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return new Response('Expected application/json',{status:415});
  const text=await request.text();if(new TextEncoder().encode(text).length>140000)return new Response('Library request too large',{status:413});
  let raw:unknown;try{raw=JSON.parse(text);}catch{return new Response('Invalid JSON',{status:400});}
  const parsed=clientRequestSchema.safeParse(raw);if(!parsed.success||parsed.data.method!==LIBRARY_ENDPOINT)return new Response('Invalid library request envelope',{status:400});
  const {rpcId,payload}=parsed.data;
  try{request.signal.throwIfAborted();return Response.json({type:'server-response',rpcId,result:{ok:true,value:await library.request(payload)}});}
  catch(error){return Response.json({type:'server-response',rpcId,result:{ok:false,error:{code:'LIBRARY',message:error instanceof Error?error.message:'Library request failed.',details:{}}}});}
}

/** Private profile data, through the host's public storage and owner transport. */
export function mountLibrary(ctx:Context){
  let current:TemplateLibrary|undefined;
  ctx.inject(['storageDomain','connection','webServer','profileContext'],async child=>{
    const spec=defineDomain({name:profileDomainName(child.profileContext.name),version:1,global:{schema:librarySchema,initial:emptyLibrary()},tables:{}});
    const domain=await child.storageDomain.open(spec);
    child.effect(()=>()=>domain.close());
    const library=new TemplateLibrary(domain.global,randomUUID);current=library;
    child.effect(()=>()=>{if(current===library)current=undefined;});
    // Pinned Connection allows one /api interceptor (already used by Gateway).
    // Its exact Fetch extension enforces owner admission and leaves Gateway
    // routes intact. The browser still uses the native correlated RPC caller.
    child.connection.fetch.register({path:'/api/'+LIBRARY_ENDPOINT,methods:['POST'],requestBody:'buffered',fetch:request=>libraryResponse(library,request)});
  });
  return ()=>current;
}
