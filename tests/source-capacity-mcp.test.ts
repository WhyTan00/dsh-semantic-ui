import {it,expect} from 'vitest';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {capacityRequest} from '../fixtures/source-capacity';
it('uses actual MCP stdio for original D2 capacity coordinates and refuses a changed current demand/source override',async()=>{
 const entry=process.env.SEMANTIC_MCP_ENTRY?[process.env.SEMANTIC_MCP_ENTRY]:['--import','tsx',resolve('src/mcp-main.ts')];
 const transport=new StdioClientTransport({command:process.execPath,args:[...entry,'--source-file',resolve('docs/evidence/natural/r9-D2.json'),'--source-json-pointer','/question','--source-kind','capacity-zh'],cwd:process.env.SEMANTIC_MCP_CWD??process.cwd(),stderr:'pipe'}),client=new Client({name:'capacity-source-contract',version:'1'});let stderr='';transport.stderr?.on('data',b=>stderr+=b);
 try{
  await client.connect(transport);const r=capacityRequest(),good=(await client.callTool({name:'semantic_ui_source_check',arguments:r})).structuredContent;
  expect(good).toHaveProperty('comparison.status','matched');expect(good).toHaveProperty('source.textSha256','8deea750b000b6ab6ffca75c3b162cbd29ea375e352d1e870fc9949ae9cc330c');expect(good).toHaveProperty('sourceCapacity.current.value',80);expect(good).toHaveProperty('computedCapacity.possibleFutureHypothesis.demand',300);
  r.view.payload.inputs[0].initial=300;const bad=(await client.callTool({name:'semantic_ui_source_check',arguments:r})).structuredContent;expect(bad).toHaveProperty('comparison.status','mismatch');expect(bad).toHaveProperty('canonicalExplanation.status','withheld');
  const override=await client.callTool({name:'semantic_ui_source_check',arguments:{source:'另一来源'}});expect(override.isError).toBe(true);expect(stderr).toBe('');
 }finally{await client.close();await transport.close();}
},20000);
