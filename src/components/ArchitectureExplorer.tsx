import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MarkerType, useReactFlow, type Node, type Edge } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import type { Architecture } from '../protocol';
import {useAppearance} from '../appearance';
export function ArchitectureExplorer({data:p}:{data:Architecture}){
  const {theme,tokens,layout}=useAppearance();
  const host=useRef<HTMLElement>(null);const [narrow,setNarrow]=useState(false);
  useEffect(()=>{if(!host.current)return;const obs=new ResizeObserver(entries=>setNarrow(entries[0].contentRect.width<480));obs.observe(host.current);return()=>obs.disconnect();},[]);
  const [selected,setSelected]=useState('');const [query,setQuery]=useState('');const [focus,setFocus]=useState(false);const [scenario,setScenario]=useState('');
  const path=p.scenarios.find(s=>s.id===scenario);
  const graph=useMemo(()=>{
    const included=focus&&selected?new Set([selected,...p.edges.filter(e=>e.source===selected||e.target===selected).flatMap(e=>[e.source,e.target])]):new Set(p.nodes.map(n=>n.id));
    const g=new dagre.graphlib.Graph({multigraph:true});g.setGraph({rankdir:layout.direction==='vertical'||layout.direction==='auto'&&narrow?'TB':'LR',nodesep:28,ranksep:40});g.setDefaultEdgeLabel(()=>({}));
    const nodes=p.nodes.filter(n=>included.has(n.id));const edges=p.edges.filter(e=>included.has(e.source)&&included.has(e.target));
    nodes.forEach(n=>g.setNode(n.id,{width:144,height:54}));edges.forEach(e=>g.setEdge(e.source,e.target,{},e.id));dagre.layout(g);
    return {nodes:nodes.map(n=>({id:n.id,data:{label:n.label},position:{x:g.node(n.id).x-72,y:g.node(n.id).y-27},selected:n.id===selected,style:{width:144,border:path?.nodeIds.includes(n.id)?`3px solid ${tokens.accent}`:`1px solid ${tokens.border}`,background:query&&n.label.toLowerCase().includes(query.toLowerCase())?tokens.highlight:tokens.surface,color:tokens.text,fontFamily:tokens.font,fontSize:tokens.size-1,borderRadius:10}} satisfies Node)),edges:edges.map(e=>({id:e.id,source:e.source,target:e.target,label:e.label??e.type,labelStyle:{fill:tokens.text,fontFamily:tokens.font},labelBgStyle:{fill:tokens.surface},markerEnd:e.directed?{type:MarkerType.ArrowClosed,color:tokens.muted}:undefined,style:{stroke:path?.edgeIds.includes(e.id)?tokens.accent:tokens.muted,strokeWidth:path?.edgeIds.includes(e.id)?3:1.5},type:e.source===e.target?'default':'smoothstep'} satisfies Edge))};
  },[p,selected,focus,path,query,narrow,theme,layout]);
  const detail=p.nodes.find(n=>n.id===selected);
  return <section ref={host} aria-label={p.title} className="explorer architecture"><h3>{p.title}</h3><div className="toolbar"><label>Find node <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search labels"/></label><label>Locate <select aria-label="Locate node" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">All nodes</option>{p.nodes.filter(n=>!query||n.label.toLowerCase().includes(query.toLowerCase())).map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label><input type="checkbox" checked={focus} disabled={!selected} onChange={e=>setFocus(e.target.checked)}/>Immediate neighborhood</label><button onClick={()=>{setFocus(false);setSelected('');setQuery('');setScenario('');}}>Restore full graph</button></div>
    {p.scenarios.length>0?<label>Scenario <select aria-label="Scenario" value={scenario} onChange={e=>setScenario(e.target.value)}><option value="">No highlight</option>{p.scenarios.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>:null}
    <p className="meta" aria-live="polite">Showing {graph.nodes.length}/{p.nodes.length} nodes · {graph.edges.length}/{p.edges.length} edges. {p.nodes.length-graph.nodes.length} nodes and {p.edges.length-graph.edges.length} edges hidden.</p>
    {p.nodes.length?<div className="graph"><ReactFlow colorMode={theme.mode} key={graph.nodes.map(n=>n.id).join(',')} nodes={graph.nodes} edges={graph.edges} fitView fitViewOptions={{padding:0.15,minZoom:0.12,maxZoom:1}} minZoom={0.12} maxZoom={2} onNodeClick={(_,n)=>setSelected(n.id)} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null} proOptions={{hideAttribution:false}}><Locate selected={selected} nodes={graph.nodes}/><Background color={tokens.line}/><span className="sr-only">Graph colors follow the selected appearance.</span><Controls showInteractive={false}/></ReactFlow></div>:<p role="status">No architecture data.</p>}
    {path?<p role="status">{path.explanation}</p>:null}
    {detail?<div className="detail"><strong>{detail.label}</strong><p>{detail.responsibility}</p>{detail.constraints.map((c,i)=><p key={i}>Constraint: {c}</p>)}<Evidence items={detail.evidence}/></div>:<p className="meta">Select a node for responsibilities and constraints.</p>}
    <details><summary>Accessible relationship list ({p.edges.length})</summary><ul>{p.edges.map(e=><li key={e.id}>{p.nodes.find(n=>n.id===e.source)?.label} {e.directed?'→':'↔'} {p.nodes.find(n=>n.id===e.target)?.label} — {e.label??e.type} ({e.type})<Evidence items={e.evidence}/></li>)}</ul></details>
  </section>;
}
export function Evidence({items}:{items:string[]}){return items.length?<details><summary>Evidence ({items.length})</summary><ul>{items.map((x,i)=><li key={i}>{x}</li>)}</ul></details>:<span className="meta"> No additional evidence supplied.</span>;}

function Locate({selected,nodes}:{selected:string;nodes:Node[]}){const flow=useReactFlow();useEffect(()=>{const n=nodes.find(n=>n.id===selected);if(n)flow.setCenter(n.position.x+72,n.position.y+27,{zoom:1,duration:180});else flow.fitView({padding:0.12,minZoom:0.12,maxZoom:1});},[selected,nodes,flow]);return null;}
