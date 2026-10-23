import type {} from '@deepseek-ai/dsh-client-ui-chat/client';
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client';
import { validateEnvelope } from '../protocol';
import { META, type Checkpoint, type ViewState } from './events';
export function checkpointOf(event:unknown):Checkpoint|undefined{
  const e=event as {type?:string;data?:{isError?:boolean;message?:{isError?:boolean};meta?:Record<string,unknown>}};
  if(!e||!['tool/result','tool/ptc-dispatch'].includes(e.type??'')||e.data?.isError||e.data?.message?.isError)return;
  const data=e.data?.meta?.[META] as Checkpoint|undefined;
  if(data&&Number.isSafeInteger(data.turn)&&typeof(data.view?.displayId??data.displayId)==='string')return data;
}
export const definition:ConversationNodeDefinition<ViewState>={
  kind:'dsh-semantic-ui',target:'chat',
  match:event=>{const data=checkpointOf(event);return data?{id:`${data.turn}:${data.view?.displayId??data.displayId}`,role:'start'}:null;},
  start:(_ctx,m)=>read(checkpointOf(m.event)!),
  update:(ctx,m)=>{
    const next=read(checkpointOf(m.event)!);const prior=ctx.state;
    if(!next.view||!prior.view)return next;
    if(next.view.component!==prior.view.component)return {...prior,issues:[{code:'IDENTITY_CONFLICT',path:'$.component',reason:'An existing display ID cannot change component type.',hint:'Use a new displayId for a different semantic component.'}]};
    if(next.view.revision<prior.view.revision)return prior;
    if(next.view.revision===prior.view.revision){if(JSON.stringify(next.view)===JSON.stringify(prior.view))return prior;return {...prior,issues:[{code:'REVISION_CONFLICT',path:'$.revision',reason:'The same revision carries different data.',hint:'Increase revision for an update.'}]};}
    return next;
  },
  buildViewNode:ctx=>ctx.state?{key:ctx.key,kind:'dsh-semantic-ui',id:ctx.id,target:'chat',anchorSeq:ctx.start?.event.seq??0,location:ctx.start?.location??{kind:'unresolved'},visibility:'visible',groupTree:'turn',data:ctx.state}:null,
};
function read(data:{turn:number;view?:unknown;issues?:ViewState['issues']}):ViewState{if(data.issues)return {turn:data.turn,issues:data.issues};const v=validateEnvelope(data.view);return v.ok?{turn:data.turn,view:v.value}:{turn:data.turn,issues:v.issues};}

declare module '@deepseek-ai/dsh-client-ui-chat/client' { interface ChatNodeDataMap { 'dsh-semantic-ui': ViewState } }
