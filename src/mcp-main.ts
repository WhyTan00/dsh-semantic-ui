import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createSemanticServer} from './mcp';
await createSemanticServer().connect(new StdioServerTransport());
