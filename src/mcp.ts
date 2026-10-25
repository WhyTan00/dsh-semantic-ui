import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {analyzeEnvelope,describeSemantic} from './core';
import {components,validateEnvelope,VERSION} from './protocol';
import {parseBounded,exportSchema,matchTemplate} from './templates';
const annotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
const reply=(value:Record<string,unknown>)=>({structuredContent:value,content:[{type:'text' as const,text:JSON.stringify(value)}]});
/** No file, network, model, credential or DSH access. UI stays with the host. */
export function createSemanticServer(){
 const server=new McpServer({name:'semantic-ui-checks',version:'0.1.0-preview.9'});
 server.registerTool('semantic_ui_schema',{title:'Inspect a semantic data contract',description:'Get the exact bounded schema for relationships, comparison requirements or chart data. Read-only. Does not render UI.',inputSchema:{component:z.enum(['ArchitectureExplorer','DecisionExplorer','DataChart'])},annotations},async({component})=>reply({...describeSemantic(component),hostRendering:'Use the available native visualizer, diagram, table or text. This server does not deliver a UI resource.'}));
 server.registerTool('semantic_ui_check',{title:'Check semantic data and compute facts',description:'Validate bounded semantic JSON and compute graph topology, numeric requirements, cautious policy results or chart statistics before explaining or rendering it. No external access; never certifies model-authored prose or source facts.',inputSchema:{view:z.unknown()},annotations},async({view})=>reply({...analyzeEnvelope(view),nativeRendering:'Use the host native visualization only when useful; retain declared data, nulls, units and computed checks. A successful check is not proof the host rendered a component.'}));
 server.registerTool('semantic_ui_template_check',{title:'Check an explicitly supplied exported template',description:'Check fresh data against a supplied exported field/appearance contract. Does not read a saved library or persist data. Supply the exported document explicitly.',inputSchema:{document:z.unknown(),view:z.unknown()},annotations},async({document,view})=>{
  const checked=validateEnvelope(view);if(!checked.ok)return reply({status:'validation-failed',issues:checked.issues.slice(0,30)});
  try{const exported=parseBounded(exportSchema,document);matchTemplate({...exported.template,version:1},checked.value);return reply({status:'compatible',protocolVersion:VERSION,component:checked.value.component,templateName:exported.template.name,boundary:'Field contract compatibility only; no original data, source verification, library mutation or automatic rendering.'});}catch(error){return reply({status:'incompatible',reason:(error as Error).message.slice(0,1200)});}
 });
 return server;
}
