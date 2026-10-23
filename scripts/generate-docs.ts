import{writeFileSync,mkdirSync}from'node:fs';
import{z}from'zod';
import{envelopeSchema,LIMITS}from'../src/protocol';
import{GUIDANCE}from'../src/dsh/guidance';
mkdirSync('docs/generated',{recursive:true});
writeFileSync('docs/generated/protocol.schema.json',JSON.stringify(z.toJSONSchema(envelopeSchema),null,2)+'\n');
writeFileSync('SKILL.md',`---\nname: dsh-semantic-ui\ndescription: Use bounded semantic UI for relationships, tradeoffs, and numeric exploration when it helps understanding.\n---\n\n${GUIDANCE}\n\nCall dsh_semantic_ui with action=describe and the chosen component to obtain the exact fields. Submit action=render with a versioned view. Reuse displayId only for the same subject within the same turn; increase revision for updates. Pure JSON only. Runtime limits: ${JSON.stringify(LIMITS)}.\n\nThe runtime skill and resident guidance use the same source. Do not copy the default json-render generation-mode prompt: this plugin uses tools.\n`);
console.log('Generated schema and skill from the protocol/guidance sources.');
