import {it,expect} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import packageJson from '../package.json' with {type:'json'};

it('reports the source package version on the actual MCP initialization wire',async()=>{
 const transport=new StdioClientTransport({command:process.execPath,args:['--import','tsx','src/mcp-main.ts'],stderr:'pipe'});
 const client=new Client({name:'semantic-version-contract',version:'1.0.0'});
 try{await client.connect(transport);expect(client.getServerVersion()).toEqual({name:'semantic-ui-checks',version:packageJson.version});}
 finally{await client.close();await transport.close();}
},20000);
