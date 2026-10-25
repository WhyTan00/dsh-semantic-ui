import {Component,createElement,useState,type ReactNode,type CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';
import {defineRegistry,Renderer,JSONUIProvider} from '@json-render/react';
import {catalog} from './catalog';
import {ArchitectureExplorer} from './components/ArchitectureExplorer';
import {DecisionExplorer} from './components/DecisionExplorer';
import {DataChart} from './components/DataChart';
import {validateEnvelope,type Envelope} from './protocol';
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
 return <AppearanceContext.Provider value={{...appearance,strictPolicy:v?.protocolVersion==='1.2'}}><div className="semantic-root" style={themeStyle(appearance.theme) as CSSProperties} data-state={issues?'validation-failed':v?'completed':'generating'}>{issues?<div role="alert" className="status-error"><strong>Cannot display semantic content</strong>{issues.map((i,n)=><p key={n}>{i.code} · {i.path}: {i.reason} {i.hint}</p>)}</div>:v?<><p className="summary">{v.protocolVersion==='1.2'?<><strong className="meta">Computed from supplied structured data · original conditions</strong><br/></>:v.component==='DataChart'?<><strong className="meta">Summary based on original full data</strong><br/></>:v.component==='DecisionExplorer'?<><strong className="meta">Model summary based on original conditions · not recomputed by local controls</strong><br/></>:null}{v.protocolVersion==='1.2'?analyzeValidated(v).canonicalSummary:v.summary}</p>{v.protocolVersion==='1.2'?<details><summary>Model interpretation (not independently verified)</summary><p>{v.summary}</p></details>:null}<Boundary key={`${v.displayId}:${v.revision}`} summary={v.summary}><JSONUIProvider registry={registry}><Renderer spec={{root:v.displayId,elements:{[v.displayId]:{type:v.component,props:v.payload,children:[]}}}} registry={registry}/></JSONUIProvider></Boundary><TemplatePanel view={v} bridge={bridge} {...appearance} onPreview={(theme,layout)=>setAppearance({theme,layout})}/><footer>Semantic UI · protocol {v.protocolVersion} · revision {v.revision}{v.presentation?.template?` · ${v.presentation.template.name} v${v.presentation.template.version}`:''} · local data controls reset on reload. Templates persist in this DSH profile; no model request or cross-device preference sync.</footer></>:<p role="status">Generating semantic content. Waiting for a validated checkpoint.</p>}</div></AppearanceContext.Provider>;
}
export function mount(element:HTMLElement,initial:ViewState,bridge?:LibraryBridge){
 const shadow=element.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=flowStyles+'\n'+styles;shadow.append(style);const body=document.createElement('div');shadow.append(body);const root=createRoot(body);
 const update=(state:ViewState)=>root.render(createElement(SemanticView,{state,bridge,key:state.view?`${state.view.displayId}:${state.view.revision}`:'pending'}));update(initial);
 return {update,dispose:()=>{queueMicrotask(()=>{root.unmount();body.remove();style.remove();});}};
}
