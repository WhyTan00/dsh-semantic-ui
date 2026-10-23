import{execFileSync}from'node:child_process';import{readFile,writeFile,mkdir}from'node:fs/promises';import{createHash}from'node:crypto';
const p=JSON.parse(await readFile('package.json','utf8'));await mkdir('artifacts',{recursive:true});
execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});
const result=JSON.parse(execFileSync('npm',['pack','--json','--pack-destination','artifacts'],{encoding:'utf8'}))[0];
if(result.files.some(f=>f.path.startsWith('.handoff/')||f.path.startsWith('artifacts/')||f.path.includes('.env')))throw Error('Private file entered package');
const packed=new Set(result.files.map(f=>f.path));
for(const required of ['dist/host.js','dist/client.js','dist/protocol.js','dist/types/dsh/host.d.ts','docs/INSTALL.zh-CN.md','docs/GENUI.zh-CN.md','docs/VALIDATION.zh-CN.md','fixtures/questions.json'])if(!packed.has(required))throw Error('Required release file missing: '+required);
for(const file of result.files.filter(f=>/\.(?:md|json|js|ts|yml|txt)$/.test(f.path))){const content=await readFile(file.path,'utf8');if(/\/Users\/|\/home\/[^\s/]+\/|[?&]token=[A-Za-z0-9_-]{12}/.test(content))throw Error('Private path or bootstrap credential found in '+file.path);}
const bytes=await readFile('artifacts/'+result.filename);const hash=createHash('sha256').update(bytes).digest('hex');await writeFile('artifacts/SHA256SUMS',`${hash}  ${result.filename}\n`);
await writeFile('artifacts/package-manifest.json',JSON.stringify({version:p.version,filename:result.filename,sha256:hash,files:result.files.map(f=>({path:f.path,size:f.size})),status:'preview; see validation evidence'},null,2)+'\n');
console.log(JSON.stringify({filename:result.filename,bytes:bytes.length,sha256:hash,files:result.files.length}));
