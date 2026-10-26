import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SOURCE_LIMITS,type SourceSnapshot} from './source-graph';

export interface SourceFileOptions{file:string;jsonPointer?:string;excerpt?:string;kind?:'arrows'|'decision-zh'}
const sha=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
/** One explicit local file, once, before accepting tool requests. Never reloads. */
export async function readSourceSnapshot(options:SourceFileOptions):Promise<SourceSnapshot>{
 let handle:Awaited<ReturnType<typeof open>>|undefined;
 try{
  handle=await open(options.file,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
  const before=await handle.stat();
  if(!before.isFile()||before.size>SOURCE_LIMITS.fileBytes)throw Error('SOURCE_FILE_LIMIT');
  const buffer=Buffer.alloc(SOURCE_LIMITS.fileBytes+1);let count=0;
  while(count<buffer.length){const read=await handle.read(buffer,count,buffer.length-count,null);if(!read.bytesRead)break;count+=read.bytesRead;}
  const after=await handle.stat();
  if(count>SOURCE_LIMITS.fileBytes)throw Error('SOURCE_FILE_LIMIT');
  if(count!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw Error('SOURCE_FILE_CHANGED');
  const document=buffer.subarray(0,count),decoded=new TextDecoder('utf-8',{fatal:true}).decode(document);
  let value:unknown=decoded;
  if(options.jsonPointer!==undefined){
   const pointer=options.jsonPointer;
   if(pointer!==''&&!pointer.startsWith('/')||pointer.length>2048)throw Error('SOURCE_POINTER');
   value=JSON.parse(decoded);
   const tokens=pointer===''?[]:pointer.slice(1).split('/');if(tokens.length>16)throw Error('SOURCE_POINTER');
   for(const token of tokens){
    if(/~(?:[^01]|$)/u.test(token))throw Error('SOURCE_POINTER');
    const key=token.replaceAll('~1','/').replaceAll('~0','~');
    if(!value||typeof value!=='object'||!Object.hasOwn(value,key))throw Error('SOURCE_POINTER');
    value=(value as Record<string,unknown>)[key];
   }
  }
  if(typeof value!=='string')throw Error('SOURCE_NOT_TEXT');
  const textBytes=Buffer.byteLength(value);if(textBytes>SOURCE_LIMITS.textBytes)throw Error('SOURCE_TEXT_LIMIT');
  const excerpt=options.excerpt??value;
  if(!excerpt.length||Buffer.byteLength(excerpt)>SOURCE_LIMITS.excerptBytes)throw Error('SOURCE_EXCERPT_LIMIT');
  const index=value.indexOf(excerpt);
  if(index<0)throw Error('SOURCE_EXCERPT_MISSING');
  if(value.indexOf(excerpt,index+1)>=0)throw Error('SOURCE_EXCERPT_AMBIGUOUS');
  const textByteStart=Buffer.byteLength(value.slice(0,index));
  return {documentSha256:sha(document),textSha256:sha(value),excerptSha256:sha(excerpt),jsonPointer:options.jsonPointer??null,textBytes,textByteStart,textByteEnd:textByteStart+Buffer.byteLength(excerpt),excerpt,...(options.kind?{kind:options.kind}:{})};
 }catch(error){
  const code=error instanceof Error&&/^SOURCE_[A-Z_]+$/u.test(error.message)?error.message:'SOURCE_FILE_UNAVAILABLE';
  throw Error(code+': The configured local source could not be captured. No fallback file or source from tool arguments was used.');
 }finally{await handle?.close();}
}

export function sourceOptions(argv:string[]):SourceFileOptions|undefined{
 const flags=new Map<string,string>();
 for(let i=0;i<argv.length;i+=2){const flag=argv[i],value=argv[i+1];if(!['--source-file','--source-json-pointer','--source-excerpt','--source-kind'].includes(flag)||value===undefined||flags.has(flag))throw Error('SOURCE_CONFIG: Use one --source-file with optional --source-json-pointer, --source-excerpt and --source-kind; unknown or duplicate options are rejected.');flags.set(flag,value);}
 const file=flags.get('--source-file');
 if(!file){if(flags.size)throw Error('SOURCE_CONFIG: Source selection requires an explicit --source-file.');return undefined;}
 const kind=flags.get('--source-kind');if(kind!==undefined&&kind!=='arrows'&&kind!=='decision-zh')throw Error('SOURCE_CONFIG: Source kind must be arrows or decision-zh.');
 return {file,...(flags.has('--source-json-pointer')?{jsonPointer:flags.get('--source-json-pointer')}:{}),...(flags.has('--source-excerpt')?{excerpt:flags.get('--source-excerpt')}: {}),...(kind?{kind}: {})};
}
