import {build} from 'esbuild';

/** Both distributions compile the same server/core; only artifact identity differs. */
export const buildMcp=({outfile,version,absWorkingDir}={})=>build({
 entryPoints:['src/mcp-main.ts'],bundle:true,format:'esm',platform:'node',outfile,
 external:['@cfworker/json-schema'],minify:true,legalComments:'linked',
 ...(absWorkingDir?{absWorkingDir}:{}),
 ...(version?{define:{__SEMANTIC_MCP_VERSION__:JSON.stringify(version)}}:{}),
 banner:{js:'#!/usr/bin/env node\nimport {createRequire as semanticCreateRequire} from "node:module";const require=semanticCreateRequire(import.meta.url);'},
});
