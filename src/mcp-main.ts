import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createSemanticServer} from './mcp';
import {sourceOptions,readSourceSnapshot} from './source-input';
try{
 const options=sourceOptions(process.argv.slice(2));
 const source=options?await readSourceSnapshot(options):undefined;
 await createSemanticServer({source}).connect(new StdioServerTransport());
}catch(error){console.error(error instanceof Error?error.message:'SOURCE_CONFIG: Startup failed.');process.exitCode=1;}
