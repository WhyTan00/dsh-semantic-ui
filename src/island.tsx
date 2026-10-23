import {Component,createElement,type ReactNode} from 'react';
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
const {registry}=defineRegistry(catalog,{components:{ArchitectureExplorer:({props})=><ArchitectureExplorer data={props}/>,DecisionExplorer:({props})=><DecisionExplorer data={props}/>,DataChart:({props})=><DataChart data={props}/>}});
class Boundary extends Component<{children:ReactNode;summary:string},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<div className="status-error" role="alert"><strong>Rendering failed.</strong><p>{this.props.summary}</p><p>Reload this view or inspect the text summary. No content was changed.</p></div>:this.props.children;}}
export function SemanticView({state}:{state:ViewState}){
 const parsed=state.view?validateEnvelope(state.view):null;const issues=state.issues??(parsed&&!parsed.ok?parsed.issues:undefined);const v=parsed?.ok?parsed.value:undefined;
 return <div className="semantic-root" data-state={issues?'validation-failed':v?'completed':'generating'}>{issues?<div role="alert" className="status-error"><strong>Cannot display semantic content</strong>{issues.map((i,n)=><p key={n}>{i.code} · {i.path}: {i.reason} {i.hint}</p>)}</div>:v?<><p className="summary">{v.summary}</p><Boundary key={`${v.displayId}:${v.revision}`} summary={v.summary}><JSONUIProvider registry={registry}><Renderer spec={{root:v.displayId,elements:{[v.displayId]:{type:v.component,props:v.payload,children:[]}}}} registry={registry}/></JSONUIProvider></Boundary><footer>Semantic UI · protocol {v.protocolVersion} · revision {v.revision} · local interactions reset on reload; no model request or cross-device preference sync.</footer></>:<p role="status">Generating semantic content. Waiting for a validated checkpoint.</p>}</div>;
}
export function mount(element:HTMLElement,initial:ViewState){
 const shadow=element.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=flowStyles+'\n'+styles;shadow.append(style);const body=document.createElement('div');shadow.append(body);const root=createRoot(body);
 const update=(state:ViewState)=>root.render(createElement(SemanticView,{state,key:state.view?`${state.view.displayId}:${state.view.revision}`:'pending'}));update(initial);
 return {update,dispose:()=>{queueMicrotask(()=>{root.unmount();body.remove();style.remove();});}};
}
