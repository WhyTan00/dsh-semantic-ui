import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {buildClient} from './client-build.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const baseVersion='0.1.0-preview.31',clientRevision=baseVersion+'-prose.3',out=join('artifacts/releases',clientRevision),root=join(out,'client');
const filename='dsh-semantic-ui-client-'+clientRevision+'.zip';assert(!existsSync(join(out,filename)),'Refusing to overwrite a frozen client archive.');
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git(['status','--porcelain']),'','Commit the source before freezing a client archive.');
const sourceCommit=git(['rev-parse','HEAD']),baseline=JSON.parse(await readFile(join('artifacts/releases',baseVersion,'package-manifest.json'),'utf8'));
assert.equal(sha(await readFile(join('artifacts/releases',baseVersion,baseline.filename))),baseline.sha256,'Base archive digest mismatch.');
await mkdir(root,{recursive:true});
await buildClient({outfile:join(root,'client.js'),islandOut:join(out,'build/island.js')});
const files=[];
for(const name of ['client.js.LEGAL.txt','client.js']){const bytes=await readFile(join(root,name));files.push({path:name,bytes:bytes.length,sha256:sha(bytes)});}
const legal=await readFile(join('artifacts/releases',baseVersion,'package/dist/client.js.LEGAL.txt')).catch(()=>undefined);
// The base archive is immutable; inspect its legal file without executing anything.
const oldLegal=legal??execFileSync('tar',['-xOf',join('artifacts/releases',baseVersion,baseline.filename),'package/dist/client.js.LEGAL.txt']);
const previousClients=[];
for(const [revision,evidence]of [['0.1.0-preview.31-prose.1','docs/evidence/prose-review.json'],['0.1.0-preview.31-prose.2','docs/evidence/prose-workflow.json']]){
 const bytes=await readFile(join('artifacts/releases',revision,'client-manifest.json')),previous=JSON.parse(bytes),accepted=JSON.parse(await readFile(evidence,'utf8'));
 assert.equal(sha(bytes),accepted.release.assets.find(a=>a.name==='client-manifest.json').sha256,'Previous frozen client manifest differs.');
 previousClients.push({clientRevision:previous.clientRevision,files:Object.fromEntries(previous.files.map(f=>[f.path,f.sha256]))});
}
const manifest={format:'dsh-semantic-ui-client-overlay',version:1,baseVersion,clientRevision,dshVersion:'0.2.1-rc.2',sourceCommit,sourceTag:'client-v'+clientRevision,baseRuntimeArchiveSha256:baseline.sha256,baseRuntimeEntrypoints:Object.fromEntries(Object.entries(baseline.runtimeEntrypoints).filter(([p])=>p!=='dist/client.js')),baseClient:{'client.js':baseline.runtimeEntrypoints['dist/client.js'],'client.js.LEGAL.txt':sha(oldLegal)},previousClients,files,scope:'Client-only finite capacity prose time, certainty, quantity roles and source-grounded explanation; host/result/session contracts unchanged.',newModelCalls:0,wholeCandidateCertification:false};
await writeFile(join(root,'client-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await copyFile('scripts/client-overlay.mjs',join(root,'client-overlay.mjs'));
for(const path of ['LICENSE','THIRD_PARTY_NOTICES.md',...git(['ls-files','licenses']).split('\n').filter(Boolean)]){const target=join(root,path);await mkdir(dirname(target),{recursive:true});await copyFile(path,target);}
await copyFile('docs/PROSE-REVIEW.zh-CN.md',join(root,'README.zh-CN.md'));
await copyFile('docs/PROSE-WORKFLOW.zh-CN.md',join(root,'PROSE-WORKFLOW.zh-CN.md'));
await copyFile('docs/PROSE-CAPACITY.zh-CN.md',join(root,'PROSE-CAPACITY.zh-CN.md'));
execFileSync('python3',['-c',"import sys,pathlib,zipfile; root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); z=zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(root).as_posix()) for p in sorted(root.rglob('*')) if p.is_file()]; z.close()",root,join(out,filename)]);
const digest=sha(await readFile(join(out,filename)));await copyFile(join(root,'client-manifest.json'),join(out,'client-manifest.json'));await writeFile(join(out,'SHA256SUMS'),digest+'  '+filename+'\n');
console.log(JSON.stringify({sourceCommit,clientRevision,filename,sha256:digest,files:files.length,outputDirectory:out}));
