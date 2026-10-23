import{execFileSync}from'node:child_process';import{mkdir,readFile,readdir,copyFile,writeFile,realpath}from'node:fs/promises';import path from'node:path';import{createRequire}from'node:module';
// pnpm --prod omits a peer when it is also installed as a dev dependency.
// Follow the installed production AND peer closure explicitly, then use the
// package manager's license metadata for those exact resolved locations.
const data=JSON.parse(execFileSync('pnpm',['licenses','list','--json'],{encoding:'utf8'}));
const runtimePaths=new Set();
async function metadata(name,parent){
 const require=createRequire(parent);try{return require.resolve(name+'/package.json');}catch{
  let directory=path.dirname(require.resolve(name));
  while(directory!==path.dirname(directory)){try{const file=path.join(directory,'package.json');if(JSON.parse(await readFile(file,'utf8')).name===name)return file;}catch{}directory=path.dirname(directory);}
  throw Error('Cannot resolve runtime license metadata: '+name);
 }
}
async function visit(file,root=false){
 const location=await realpath(path.dirname(file));if(runtimePaths.has(location))return;if(!root)runtimePaths.add(location);
 const meta=JSON.parse(await readFile(file,'utf8'));
 for(const name of Object.keys({...meta.dependencies,...meta.peerDependencies,...meta.optionalDependencies})){
  let child;try{child=await metadata(name,file);}catch(error){if(meta.optionalDependencies?.[name]||meta.peerDependenciesMeta?.[name]?.optional)continue;throw error;}
  await visit(child);
 }
}
await visit(path.resolve('package.json'),true);
let rows=[],missing=[];await mkdir('licenses',{recursive:true});
for(const [license,pkgs]of Object.entries(data))for(const pkg of pkgs){
 for(const location of pkg.paths??[]){if(!runtimePaths.has(await realpath(location)))continue;const meta=JSON.parse(await readFile(path.join(location,'package.json'),'utf8'));const slug=meta.name.replace(/^@/,'').replaceAll('/','__')+'@'+meta.version;const dest=path.join('licenses',slug);await mkdir(dest,{recursive:true});
 const entries=await readdir(location,{withFileTypes:true});
 const files=entries.filter(f=>f.isFile()&&/^(licen[cs]e|copying|notice|copyright)(\.|$)/i.test(f.name)).map(f=>f.name);
 async function nested(relative,depth=0){if(depth>4)return;for(const entry of await readdir(path.join(location,relative),{withFileTypes:true})){const child=path.join(relative,entry.name);if(entry.isDirectory())await nested(child,depth+1);else if(entry.isFile())files.push(child);}}
 for(const entry of entries)if(entry.isDirectory()&&/^licenses?$/i.test(entry.name))await nested(entry.name);
 for(const file of files){await mkdir(path.dirname(path.join(dest,file)),{recursive:true});await copyFile(path.join(location,file),path.join(dest,file));}
 if(!files.length)missing.push(slug);
 rows.push({name:meta.name,version:meta.version,license:meta.license??license,files:files.map(f=>`licenses/${slug}/${f}`)});
 }
}
rows=[...new Map(rows.map(r=>[r.name+'@'+r.version,r])).values()].sort((a,b)=>(a.name+a.version).localeCompare(b.name+b.version));
await writeFile('docs/generated/dependency-licenses.json',JSON.stringify(rows,null,2)+'\n');
await writeFile('THIRD_PARTY_NOTICES.md','# Third-party notices\n\nOriginal project code is MIT. The following exact installed production dependencies and peer runtime dependencies retain their own copyright and license. Browser bundle legal notices also ship in dist/client.js.LEGAL.txt. Development-only tooling is governed by its installed license and the lockfile.\n\n| Package | Version | License | Retained notices |\n|---|---|---|---|\n'+rows.map(r=>`| ${r.name} | ${r.version} | ${typeof r.license==='string'?r.license:JSON.stringify(r.license)} | ${r.files.map(f=>`[${path.basename(f)}](${f})`).join(', ')||'See package metadata'} |`).join('\n')+'\n');
console.log(JSON.stringify({packages:rows.length,licenseFamilies:[...new Set(rows.map(r=>r.license))],withoutRootLicenseFile:missing}));
