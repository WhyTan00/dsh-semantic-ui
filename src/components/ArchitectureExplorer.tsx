import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MarkerType, Position, BaseEdge, getSmoothStepPath, useReactFlow, useStore, getViewportForBounds, ControlButton, type Node, type Edge, type EdgeProps, type OnNodesChange } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import type { Architecture } from '../protocol';
import {useAppearance} from '../appearance';
const edgeTypes={semantic:SemanticEdge};
export function ArchitectureExplorer({data:p}:{data:Architecture}){
  const {theme,tokens,layout}=useAppearance();
  const host=useRef<HTMLElement>(null);const [narrow,setNarrow]=useState(false);
  useEffect(()=>{if(!host.current)return;const obs=new ResizeObserver(entries=>setNarrow(entries[0].contentRect.width<480));obs.observe(host.current);return()=>obs.disconnect();},[]);
  const [selected,setSelected]=useState('');const [query,setQuery]=useState('');const [focus,setFocus]=useState(false);const [scenario,setScenario]=useState('');
  const onNodesChange=useCallback<OnNodesChange>(changes=>setSelected(current=>{const chosen=changes.find(c=>c.type==='select'&&c.selected);return chosen?.type==='select'?chosen.id:changes.some(c=>c.type==='select'&&!c.selected&&c.id===current)?'':current;}),[]);
  const path=p.scenarios.find(s=>s.id===scenario);
  const graph=useMemo(()=>{
    const included=focus&&selected?new Set([selected,...p.edges.filter(e=>e.source===selected||e.target===selected).flatMap(e=>[e.source,e.target])]):new Set(p.nodes.map(n=>n.id));
    const vertical=layout.direction==='vertical'||layout.direction==='auto'&&narrow;
    const g=new dagre.graphlib.Graph({multigraph:true});g.setGraph({rankdir:vertical?'TB':'LR',nodesep:28,ranksep:40});g.setDefaultEdgeLabel(()=>({}));
    const nodes=p.nodes.filter(n=>included.has(n.id));const edges=p.edges.filter(e=>included.has(e.source)&&included.has(e.target));
    nodes.forEach(n=>g.setNode(n.id,{width:144,height:54}));edges.forEach(e=>g.setEdge(e.source,e.target,{},e.id));dagre.layout(g);
    const pairs=new Map<string,string[]>();for(const e of edges){const key=JSON.stringify([e.source,e.target].sort());pairs.set(key,[...(pairs.get(key)??[]),e.id]);}
    return {nodes:nodes.map(n=>({id:n.id,data:{label:<span className="graph-node-label" title={n.label}>{n.label}</span>},ariaLabel:n.label,deletable:false,sourcePosition:vertical?Position.Bottom:Position.Right,targetPosition:vertical?Position.Top:Position.Left,position:{x:g.node(n.id).x-72,y:g.node(n.id).y-27},selected:n.id===selected,style:{width:144,height:54,border:path?.nodeIds.includes(n.id)?`3px solid ${tokens.accent}`:`1px solid ${tokens.border}`,background:query&&n.label.toLowerCase().includes(query.toLowerCase())?tokens.highlight:tokens.surface,color:tokens.text,fontFamily:tokens.font,fontSize:tokens.size-1,borderRadius:10}} satisfies Node)),edges:edges.map(e=>{const group=pairs.get(JSON.stringify([e.source,e.target].sort()))!,lane=e.source===e.target?group.indexOf(e.id)*24:(group.indexOf(e.id)-(group.length-1)/2)*48;return {id:e.id,source:e.source,target:e.target,label:e.label??e.type,ariaLabel:`${p.nodes.find(n=>n.id===e.source)?.label} ${e.directed?'to':'with'} ${p.nodes.find(n=>n.id===e.target)?.label}: ${e.label??e.type}`,deletable:false,data:{lane},labelStyle:{fill:tokens.text,fontFamily:tokens.font},labelBgStyle:{fill:tokens.surface},markerEnd:e.directed?{type:MarkerType.ArrowClosed,color:tokens.muted}:undefined,style:{stroke:path?.edgeIds.includes(e.id)?tokens.accent:tokens.muted,strokeWidth:path?.edgeIds.includes(e.id)?3:1.5},type:'semantic'} satisfies Edge;})};
  },[p,selected,focus,path,query,narrow,theme,layout]);
  const detail=p.nodes.find(n=>n.id===selected);
  return <section ref={host} aria-label={p.title} className="explorer architecture"><h3>{p.title}</h3><div className="toolbar"><label>Find node <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search labels"/></label><label>Locate <select aria-label="Locate node" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">All nodes</option>{p.nodes.filter(n=>!query||n.label.toLowerCase().includes(query.toLowerCase())).map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label><input type="checkbox" checked={focus} disabled={!selected} onChange={e=>setFocus(e.target.checked)}/>Immediate neighborhood</label><button onClick={()=>{setFocus(false);setSelected('');setQuery('');setScenario('');}}>Restore full graph</button></div>
    {p.scenarios.length>0?<label>Scenario <select aria-label="Scenario" value={scenario} onChange={e=>setScenario(e.target.value)}><option value="">No highlight</option>{p.scenarios.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>:null}
    <p className="meta" aria-live="polite">Showing {graph.nodes.length}/{p.nodes.length} nodes · {graph.edges.length}/{p.edges.length} edges. {p.nodes.length-graph.nodes.length} nodes and {p.edges.length-graph.edges.length} edges hidden.</p>
    {p.nodes.length?<div className="graph"><ReactFlow colorMode={theme.mode} key={graph.nodes.map(n=>n.id).join(',')} nodes={graph.nodes} edges={graph.edges} edgeTypes={edgeTypes} minZoom={0.12} maxZoom={2} onNodesChange={onNodesChange} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null} zoomOnScroll={false} zoomOnDoubleClick={false} preventScrolling={false} ariaLabelConfig={{'node.a11yDescription.default':'Press Enter or Space to inspect this node. Escape clears selection. Relationships are read-only.','edge.a11yDescription.default':'Read-only relationship. Details are available in the relationship list.'}} proOptions={{hideAttribution:false}}><Locate selected={selected} nodes={graph.nodes} edges={graph.edges}/><Background color={tokens.line}/><span className="sr-only">Graph colors follow the selected appearance.</span></ReactFlow></div>:<p role="status">No architecture data.</p>}
    <p className="meta">Tab to a node and press Enter or Space to inspect it. Use Locate or zoom controls without dragging. Wheel scrolling continues through the conversation.</p>
    {path?<p role="status">{path.explanation}</p>:null}
    {detail?<div className="detail"><strong>{detail.label}</strong><p>{detail.responsibility}</p>{detail.constraints.map((c,i)=><p key={i}>Constraint: {c}</p>)}<Evidence items={detail.evidence}/></div>:<p className="meta">Select a node for responsibilities and constraints.</p>}
    <details><summary>Accessible relationship list ({p.edges.length})</summary><ul>{p.edges.map(e=><li key={e.id}>{p.nodes.find(n=>n.id===e.source)?.label} {e.directed?'→':'↔'} {p.nodes.find(n=>n.id===e.target)?.label} — {e.label??e.type} ({e.type})<Evidence items={e.evidence}/></li>)}</ul></details>
  </section>;
}
export function Evidence({items}:{items:string[]}){return items.length?<details><summary>Evidence ({items.length})</summary><ul>{items.map((x,i)=><li key={i}>{x}</li>)}</ul></details>:<span className="meta"> No additional evidence supplied.</span>;}

function Locate({selected,nodes,edges}:{selected:string;nodes:Node[];edges:Edge[]}){
  const flow=useReactFlow(),width=useStore(s=>s.width),height=useStore(s=>s.height);
  const geometry=JSON.stringify(nodes.map(n=>({id:n.id,x:n.position.x,y:n.position.y})));
  // Include custom edge excursions, and use current container dimensions rather than
  // React Flow's previous node measurements during a responsive layout change.
  const inset=Math.max(20,...edges.map(e=>e.source===e.target?90+Number(e.data?.lane??0):Math.abs(Number(e.data?.lane??0))));
  const fit=useCallback((locate:boolean)=>{
    if(!width||!height||!flow.viewportInitialized)return;
    const positions=JSON.parse(geometry)as {id:string;x:number;y:number}[],n=positions.find(n=>n.id===selected);
    const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:180;
    if(locate&&n){void flow.setCenter(n.x+72,n.y+27,{zoom:1,duration});return;}
    const x=Math.min(...positions.map(n=>n.x))-inset,y=Math.min(...positions.map(n=>n.y))-inset;
    const bounds={x,y,width:Math.max(...positions.map(n=>n.x+144))+inset-x,height:Math.max(...positions.map(n=>n.y+54))+inset-y};
    void flow.setViewport(getViewportForBounds(bounds,width,height,0.12,1,0.05),{duration});
  },[geometry,selected,width,height,inset,flow]);
  useEffect(()=>{fit(true);},[fit]);
  return <Controls showInteractive={false} showFitView={false}><ControlButton title="Fit all nodes and relationships" aria-label="Fit all nodes and relationships" onClick={()=>fit(false)}>↔</ControlButton></Controls>;
}

/** Preserve separate declared relations, including parallel edges and self-loops. */
function SemanticEdge(props:EdgeProps){
  const {sourceX:sx,sourceY:sy,targetX:tx,targetY:ty,sourcePosition,targetPosition}=props;
  const lane=typeof props.data?.lane==='number'?props.data.lane:0;
  let path:string,labelX:number,labelY:number;
  if(props.source===props.target){
    const radius=160+lane,vertical=sourcePosition===Position.Bottom;
    path=vertical?`M ${sx},${sy} C ${sx+radius},${sy+radius} ${tx+radius},${ty-radius} ${tx},${ty}`:`M ${sx},${sy} C ${sx+radius},${sy-radius} ${tx-radius},${ty-radius} ${tx},${ty}`;
    labelX=vertical?sx+radius*0.75:(sx+tx)/2;labelY=vertical?(sy+ty)/2:sy-radius*0.75;
  }else if(lane){
    const distance=Math.hypot(tx-sx,ty-sy)||1,sign=props.source<props.target?1:-1;
    const dx=-(ty-sy)/distance*lane*sign,dy=(tx-sx)/distance*lane*sign,cx=(sx+tx)/2+dx,cy=(sy+ty)/2+dy;
    path=`M ${sx},${sy} Q ${cx},${cy} ${tx},${ty}`;labelX=(sx+tx)/2+dx/2;labelY=(sy+ty)/2+dy/2;
  }else [path,labelX,labelY]=getSmoothStepPath({sourceX:sx,sourceY:sy,targetX:tx,targetY:ty,sourcePosition,targetPosition});
  return <BaseEdge id={props.id} path={path} labelX={labelX} labelY={labelY} label={props.label} labelStyle={props.labelStyle} labelBgStyle={props.labelBgStyle} style={props.style} markerEnd={props.markerEnd} interactionWidth={props.interactionWidth}/>;
}
