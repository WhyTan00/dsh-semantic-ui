import {createHash} from 'node:crypto';
import {sourceReferenceFromSnapshot} from '../src/source-reference.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
/** Existing synchronous Node entry; construction/checking now share the browser-safe implementation. */
export function sourceReference(core,text,requestedKind){
 const digest=sha(text),bytes=Buffer.byteLength(text);
 return sourceReferenceFromSnapshot(core,{documentSha256:digest,textSha256:digest,excerptSha256:digest,jsonPointer:null,excerpt:text,textBytes:bytes,textByteStart:0,textByteEnd:bytes},requestedKind);
}
