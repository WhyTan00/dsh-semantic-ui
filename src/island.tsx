import {Component,createElement,useState,type ReactNode,type CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';
import {defineRegistry,Renderer,JSONUIProvider} from '@json-render/react';
import {catalog} from './catalog';
import {ArchitectureExplorer} from './components/ArchitectureExplorer';
import {DecisionExplorer} from './components/DecisionExplorer';
import {DataChart} from './components/DataChart';
import {validateEnvelope,usesReviewedPolicy,type Envelope} from './protocol';
import type {ViewState} from './dsh/events';
import styles from './styles.css?inline';
import flowStyles from '@xyflow/react/dist/style.css?inline';
import {analyzeValidated} from './core';
import {AppearanceContext} from './appearance';
import {defaultTheme,defaultLayout,themeStyle} from './theme';
import {TemplatePanel} from './components/TemplatePanel';
import type {LibraryBridge} from './templates';
const {registry}=defineRegistry(catalog,{components:{ArchitectureExplorer:({props})=><ArchitectureExplorer data={props}/>,DecisionExplorer:({props})=><DecisionExplorer data={props}/>,DataChart:({props})=><DataChart data={props}/>}});
class Boundary extends Component<{children:ReactNode;summary:string},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<div className="status-error" role="alert"><strong>Rendering failed.</strong><p>{this.props.summary}</p><p>Reload this view or inspect the text summary. No content was changed.</p></div>:this.props.children;}}
export function SemanticView({state,bridge}:{state:ViewState;bridge?:LibraryBridge}){
 const parsed=state.view?validateEnvelope(state.view):null;const issues=state.issues??(parsed&&!parsed.ok?parsed.issues:undefined);const v=parsed?.ok?parsed.value:undefined;
 const [appearance,setAppearance]=useState(()=>({theme:v?.presentation?.theme??defaultTheme,layout:v?.presentation?.layout??defaultLayout}));
 return <AppearanceContext.Provider value={{...appearance,strictPolicy:!!v&&usesReviewedPolicy(v.protocolVersion)}}><div className="semantic-root" style={themeStyle(appearance.theme) as CSSProperties} data-state={issues?'validation-failed':v?'completed':'generating'}>{issues?<div role="alert" className="status-error"><strong>Cannot display semantic content</strong>{issues.map((i,n)=><p key={n}>{i.code} · {i.path}: {i.reason} {i.hint}</p>)}</div>:v?<>{state.sourceDelivery?.status==='bound'?<section className="source-explanation" aria-label="来源文字内的有限核对"><strong>来源文字内的有限核对 · {state.sourceDelivery.kind==='decision-zh'?'原始条件与取舍':'直接访问与权限'}</strong><p style={{whiteSpace:'pre-line'}}>{state.sourceDelivery.explanation}</p><p className="meta">模型摘要、注释、排名与政策结论未用于这份来源投影。人类身份、世界事实及组件外自由正文未认证。</p>{state.sourceDelivery.kind==='decision-zh'?<p className="meta" data-original-condition-scope>以上固定说明原始来源条件。下方控件仅做本地假设试算，不改来源事实，不填补未知方案信息，也不认证新的世界事实。</p>:null}<details><summary>来源记录与范围</summary><p>文本 SHA-256：{state.sourceDelivery.sourceRef.textSha256}</p><p>回合 {state.sourceDelivery.sourceRef.hostContext.turn} · 消息序号 {state.sourceDelivery.sourceRef.hostContext.messageSeq}。仅对应已保存的来源文字和该版本投影。</p></details></section>:state.sourceDelivery?<p className="meta" data-source-unverified>来源未核 · {state.sourceDelivery.code}：{state.sourceDelivery.reason}</p>:null}<p className="summary">{usesReviewedPolicy(v.protocolVersion)?<><strong className="meta">Computed from supplied structured data · original conditions</strong><br/></>:v.component==='DataChart'?<><strong className="meta">Summary based on original full data</strong><br/></>:v.component==='DecisionExplorer'?<><strong className="meta">Model summary based on original conditions · not recomputed by local controls</strong><br/></>:null}{usesReviewedPolicy(v.protocolVersion)?analyzeValidated(v).canonicalSummary:v.summary}</p>{usesReviewedPolicy(v.protocolVersion)&&state.sourceDelivery?.status!=='bound'?<details><summary>Model interpretation (not independently verified)</summary><p>{v.summary}</p></details>:null}<Boundary key={`${v.displayId}:${v.revision}`} summary={v.summary}><JSONUIProvider registry={registry}><Renderer spec={{root:v.displayId,elements:{[v.displayId]:{type:v.component,props:v.payload,children:[]}}}} registry={registry}/></JSONUIProvider></Boundary><TemplatePanel view={v} bridge={bridge} {...appearance} onPreview={(theme,layout)=>setAppearance({theme,layout})}/><footer>Semantic UI · protocol {v.protocolVersion} · revision {v.revision}{v.presentation?.template?` · ${v.presentation.template.name} v${v.presentation.template.version}`:''} · local data controls reset on reload. Templates persist in this DSH profile; no model request or cross-device preference sync.</footer></>:<p role="status">Generating semantic content. Waiting for a validated checkpoint.</p>}</div></AppearanceContext.Provider>;
}
export function mount(element:HTMLElement,initial:ViewState,bridge?:LibraryBridge){
 const shadow=element.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=flowStyles+'\n'+styles;shadow.append(style);const body=document.createElement('div');shadow.append(body);const root=createRoot(body);
 const update=(state:ViewState)=>root.render(createElement(SemanticView,{state,bridge,key:state.view?`${state.view.displayId}:${state.view.revision}`:'pending'}));update(initial);
 return {update,dispose:()=>{queueMicrotask(()=>{root.unmount();body.remove();style.remove();});}};
}
