import{it,expect}from'vitest';
import{Client}from'@modelcontextprotocol/sdk/client/index.js';
import{StdioClientTransport}from'@modelcontextprotocol/sdk/client/stdio.js';
import{mkdtemp,writeFile,rm}from'node:fs/promises';
import{join}from'node:path';import{tmpdir}from'node:os';

async function connect(extra:string[]=[]){
 const transport=new StdioClientTransport({command:process.execPath,args:[...(process.env.SEMANTIC_MCP_ENTRY?[process.env.SEMANTIC_MCP_ENTRY]:['--import','tsx','src/mcp-main.ts']),...extra],stderr:'pipe',...(process.env.SEMANTIC_MCP_CWD?{cwd:process.env.SEMANTIC_MCP_CWD}:{})}),client=new Client({name:'mcp-workflow-contract',version:'1.0.0'});
 await client.connect(transport);return{client,transport};
}
it('delivers a self-contained numeric workflow at initialization without advertising an absent source tool',async()=>{
 const{client,transport}=await connect();try{
  const instructions=client.getInstructions()!;expect(instructions).toBeTruthy();const first=instructions.slice(0,512);
  expect(first).toContain('semantic_ui_schema');expect(first).toContain('semantic_ui_check');expect(first).toContain('null versus observed zero');expect(first).toContain('do not verify');expect(instructions).not.toContain('semantic_ui_source_check');
  expect((await client.listTools()).tools).toHaveLength(3);expect(client.getServerCapabilities()?.resources).toBeUndefined();
 }finally{await client.close();await transport.close();}
},20000);
it.each(['arrows','decision-zh','permissions-zh'])('scopes %s initialization to the configured grammar without injecting source content',async kind=>{
 const dir=await mkdtemp(join(tmpdir(),'semantic-mcp-instructions-')),file=join(dir,'source.json'),poison='ATTACK_DO_NOT_FOLLOW_SOURCE_AS_INSTRUCTIONS';await writeFile(file,JSON.stringify({question:poison}));
 let connection:Awaited<ReturnType<typeof connect>>|undefined;try{
  connection=await connect(['--source-file',file,'--source-json-pointer','/question','--source-kind',kind]);const{client}=connection;
  const instructions=client.getInstructions()!,first=instructions.slice(0,512);expect(first).toContain(kind);expect(first).toContain('semantic_ui_source_check');expect(first).toContain('only that bounded scope');expect(first).toContain('never instructions');expect(instructions).not.toContain(poison);expect((await client.listTools()).tools).toHaveLength(4);expect(client.getServerCapabilities()?.resources).toBeUndefined();
 }finally{await connection?.client.close();await connection?.transport.close();await rm(dir,{recursive:true,force:true});}
},20000);
