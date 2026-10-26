import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readSourceSnapshot,sourceOptions} from '../src/source-input';
import {checkSourceGraph,SOURCE_LIMITS} from '../src/source-graph';

it('captures bytes once; later file changes do not change the comparison source',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'semantic-source-'));
 try{const file=join(dir,'input.txt');await writeFile(file,'Alpha→Beta');const source=await readSourceSnapshot({file});await writeFile(file,'Beta→Alpha');const result=checkSourceGraph(source,{claims:[{kind:'edge',from:'Alpha',to:'Beta'}]});expect(result.claimChecks).toHaveProperty('0.status','supported');expect(source.excerpt).toBe('Alpha→Beta');}finally{await rm(dir,{recursive:true,force:true});}
});
it('resolves only an explicit text JSON pointer and a unique exact source excerpt',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'semantic-source-'));
 try{
  const file=join(dir,'input.json');await writeFile(file,JSON.stringify({'a/b':{'~':{question:'说明：甲→乙；后文'}}}));
  const source=await readSourceSnapshot({file,jsonPointer:'/a~1b/~0/question',excerpt:'甲→乙'});
  expect(source.textByteStart).toBe(Buffer.byteLength('说明：'));expect(source.textByteEnd-source.textByteStart).toBe(Buffer.byteLength('甲→乙'));
  await expect(readSourceSnapshot({file,jsonPointer:'/missing'})).rejects.toThrow('SOURCE_POINTER');
  await expect(readSourceSnapshot({file,jsonPointer:'/a~2b'})).rejects.toThrow('SOURCE_POINTER');
  await expect(readSourceSnapshot({file,jsonPointer:'/a~1b'})).rejects.toThrow('SOURCE_NOT_TEXT');
  await expect(readSourceSnapshot({file,jsonPointer:'/a~1b/~0/question',excerpt:'不存在'})).rejects.toThrow('SOURCE_EXCERPT_MISSING');
  await writeFile(file,JSON.stringify({q:'甲→乙;甲→乙'}));
  await expect(readSourceSnapshot({file,jsonPointer:'/q',excerpt:'甲→乙'})).rejects.toThrow('SOURCE_EXCERPT_AMBIGUOUS');
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('fails closed on symlinks, directories, invalid UTF-8, oversized inputs and absent files without leaking paths',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'semantic-source-'));
 try{
  const file=join(dir,'input.txt'),link=join(dir,'link.txt');await writeFile(file,'A→B');await symlink(file,link);
  await expect(readSourceSnapshot({file:link})).rejects.toThrow('SOURCE_FILE_UNAVAILABLE');
  await expect(readSourceSnapshot({file:dir})).rejects.toThrow('SOURCE_FILE_LIMIT');
  await writeFile(file,Buffer.from([0xff]));await expect(readSourceSnapshot({file})).rejects.toThrow('SOURCE_FILE_UNAVAILABLE');
  await writeFile(file,'x'.repeat(SOURCE_LIMITS.fileBytes+1));await expect(readSourceSnapshot({file})).rejects.toThrow('SOURCE_FILE_LIMIT');
  try{await readSourceSnapshot({file:join(dir,'absent')});throw Error('unexpected');}catch(error){expect(String(error)).not.toContain(dir);expect(String(error)).toContain('SOURCE_FILE_UNAVAILABLE');}
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('does not enable source access by default or accept request-shaped authority/configuration overrides',()=>{
 expect(sourceOptions([])).toBeUndefined();
 expect(sourceOptions(['--source-file','example.json','--source-json-pointer','/question','--source-excerpt','A→B'])).toEqual({file:'example.json',jsonPointer:'/question',excerpt:'A→B'});
 for(const args of [['--source-json-pointer','/q'],['--source-file'],['--source-file','a','--source-file','b'],['--source-file','a','--claimed-authority','trusted']])expect(()=>sourceOptions(args)).toThrow('SOURCE_CONFIG');
});
