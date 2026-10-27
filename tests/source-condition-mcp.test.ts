import{it,expect}from'vitest';
import{resolve}from'node:path';
import{Client}from'@modelcontextprotocol/sdk/client/index.js';
import{StdioClientTransport}from'@modelcontextprotocol/sdk/client/stdio.js';
import{conditionSamples,conditionRequest}from'../fixtures/source-condition';
it('runs explicit conditional source inspection/comparison/claim refusal through the actual standalone MCP',async()=>{
 for(const[index,s]of conditionSamples.entries()){
  const entry=process.env.SEMANTIC_MCP_ENTRY?[process.env.SEMANTIC_MCP_ENTRY]:['--import','tsx',resolve('src/mcp-main.ts')];
  const transport=new StdioClientTransport({command:process.execPath,args:[...entry,'--source-file',resolve('fixtures/source-condition.json'),'--source-json-pointer',`/samples/${index}/source`,'--source-kind','decision-zh'],cwd:process.env.SEMANTIC_MCP_CWD??process.cwd(),stderr:'pipe'});
  const client=new Client({name:'conditional-source-contract',version:'1.0'});let stderr='';transport.stderr?.on('data',b=>stderr+=b);await client.connect(transport);
  try{
   const r=await client.callTool({name:'semantic_ui_source_check',arguments:{}});expect(r.structuredContent).toHaveProperty('source.textSha256',s.sourceSha256);expect(r.structuredContent).toHaveProperty('sourceDecision.conditionalNeeds.0.derivedNeed',index===0?false:null);expect(r.structuredContent).toHaveProperty('canonicalExplanation.status','available');
   const request=index===0?conditionRequest():conditionRequest(['松湾','竹湾'],'加密',null,[true,null],'sdk');expect((await client.callTool({name:'semantic_ui_source_check',arguments:request})).structuredContent).toHaveProperty('comparison.status','matched');
   const name=index===0?'离线':'加密',condition=index===0?'现场断网':'使用公网';
   const bad=await client.callTool({name:'semantic_ui_source_check',arguments:{claims:[{kind:'conditional-need',name,condition,whenTrue:false,whenFalse:true}]}});expect(bad.structuredContent).toHaveProperty('claimChecks.0.status','unsupported-by-source');expect(bad.structuredContent).toHaveProperty('canonicalExplanation.status','withheld');expect(stderr).toBe('');
  }finally{await client.close();await transport.close();}
 }
},20000);
