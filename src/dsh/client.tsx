import { createElement, useEffect, useRef } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { ChatNodeViewProps } from '@deepseek-ai/dsh-client-ui-chat/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {ConnectionHandle} from '@deepseek-ai/dsh-client-connection/client';
import type {LibraryBridge,Library} from '../templates';
import {SOURCE_UPDATE_ENDPOINT,type SourceUpdateBridge,type SourceUpdateResult} from '../source-update-contract';
import { definition } from './definition';
import { mount } from '../host-island';
export const name='dsh-semantic-ui-client';
export const inject=['uiConversation','slots','connection'];
function SemanticNode({node,bridge,updateBridge}:ChatNodeViewProps<'dsh-semantic-ui'>&{bridge:LibraryBridge;updateBridge:SourceUpdateBridge}){
  const el=useRef<HTMLDivElement>(null);const mounted=useRef<ReturnType<typeof mount>|null>(null);
  useEffect(()=>{if(!el.current)return;mounted.current=mount(el.current,node.data,bridge,updateBridge);return()=>{mounted.current?.dispose();mounted.current=null;};},[bridge,updateBridge]);
  useEffect(()=>{mounted.current?.update(node.data);},[node.data]);
  return createElement('div',{'data-semantic-ui':node.id,ref:el,style:{minWidth:0,width:'100%'}});
}
// Host and browser Context augmentations share this build's type-check scope.
// Keep the public browser handle explicit rather than casting its RPC to any.
export function apply(ctx:Omit<Context,'connection'>&{connection:ConnectionHandle}){
  const bridge:LibraryBridge=async request=>{const result=await ctx.connection.rpc.call('/api','dsh-semantic-ui/library',request);if(!result.ok)throw Error(result.error.message);return result.value as Library;};
  const updateBridge:SourceUpdateBridge=async request=>{const result=await ctx.connection.rpc.call('/api',SOURCE_UPDATE_ENDPOINT,request);if(!result.ok)throw Error(result.error.message);return result.value as SourceUpdateResult;};
  ctx.uiConversation.events.register(definition);ctx.slots.inject('conversation.chat.node',()=>ctx.slots.register({name:'conversation.chat.node',key:'dsh-semantic-ui'},props=>createElement(SemanticNode,{...props,bridge,updateBridge})));
}
