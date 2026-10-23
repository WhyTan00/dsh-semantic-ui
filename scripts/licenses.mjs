import{execFileSync}from'node:child_process';import{mkdir,readFile,readdir,copyFile,writeFile}from'node:fs/promises';import path from'node:path';
const data=JSON.parse(execFileSync('pnpm',['licenses','list','--prod','--json'],{encoding:'utf8'}));
let rows=[],missing=[];await mkdir('licenses',{recursive:true});
for(const [license,pkgs]of Object.entries(data))for(const pkg of pkgs){
 for(const location of pkg.paths??[]){const meta=JSON.parse(await readFile(path.join(location,'package.json'),'utf8'));const slug=meta.name.replace(/^@/,'').replaceAll('/','__')+'@'+meta.version;const dest=path.join('licenses',slug);await mkdir(dest,{recursive:true});
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
console.log(JSON.stringify({packages:rows.length,licenseFamilies:Object.keys(data),withoutRootLicenseFile:missing}));
