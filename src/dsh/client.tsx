import { createElement, useEffect, useRef } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { ChatNodeViewProps } from '@deepseek-ai/dsh-client-ui-chat/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import { definition } from './definition';
import { mount } from '../host-island';
export const name='dsh-semantic-ui-client';
export const inject=['uiConversation','slots'];
function SemanticNode({node}:ChatNodeViewProps<'dsh-semantic-ui'>){
  const el=useRef<HTMLDivElement>(null);const mounted=useRef<ReturnType<typeof mount>|null>(null);
  useEffect(()=>{if(!el.current)return;mounted.current=mount(el.current,node.data);return()=>{mounted.current?.dispose();mounted.current=null;};},[]);
  useEffect(()=>{mounted.current?.update(node.data);},[node.data]);
  return createElement('div',{'data-semantic-ui':node.id,ref:el,style:{minWidth:0,width:'100%'}});
}
export function apply(ctx:Context){ctx.uiConversation.events.register(definition);ctx.slots.inject('conversation.chat.node',()=>ctx.slots.register({name:'conversation.chat.node',key:'dsh-semantic-ui'},SemanticNode));}
