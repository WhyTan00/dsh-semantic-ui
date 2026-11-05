import {readFileSync,writeFileSync,realpathSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {dirname,resolve,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(base,path)=>{const rel=relative(base,path);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('../');};
const names=['client.js.LEGAL.txt','client.js'];

/** Explicit personal profile only. Never edits a shared pnpm store or restarts the host. */
export function applyClientOverlay(bundleDirectory,profileDirectory,rollbackDirectory){
 const bundle=realpathSync(bundleDirectory),profile=realpathSync(profileDirectory),pkg=realpathSync(join(profile,'node_modules/@whytan/dsh-semantic-ui'));
 assert(inside(profile,pkg),'Installed package must be physically inside the selected personal profile.');
 const manifest=JSON.parse(readFileSync(join(bundle,'client-manifest.json')));
 assert.equal(manifest.format,'dsh-semantic-ui-client-overlay');assert.equal(manifest.version,1);
 assert.match(manifest.clientRevision,/^[A-Za-z0-9.-]{1,80}$/);
 assert.equal(JSON.parse(readFileSync(join(pkg,'package.json'))).version,manifest.baseVersion);
 for(const [path,expected]of Object.entries(manifest.baseRuntimeEntrypoints)){assert(['dist/host.js','dist/core.js','dist/mcp.js','dist/protocol.js'].includes(path));assert.equal(sha(readFileSync(join(pkg,path))),expected,'Base runtime differs: '+path);}
 const backup=rollbackDirectory?realpathSync(rollbackDirectory):join(profile,'.semantic-ui-client-backups',manifest.clientRevision+'-'+randomUUID());
 if(rollbackDirectory)assert(inside(join(profile,'.semantic-ui-client-backups'),backup),'Rollback backup must belong to this profile.');
 const approved=[manifest.baseClient,...(manifest.previousClients??[]).map(previous=>previous.files)];
 const baseClient=approved.find(files=>names.every(name=>sha(readFileSync(join(rollbackDirectory?backup:join(pkg,'dist'),name)))===files[name]))??manifest.baseClient;
 const rows=names.map(name=>{
  const file=manifest.files.find(f=>f.path===name);assert(file,'Manifest file missing.');
  const target=join(pkg,'dist',name);assert(inside(pkg,realpathSync(target)),'Asset points outside installed package.');
  const expected=rollbackDirectory?file.sha256:baseClient[name],replacement=rollbackDirectory?baseClient[name]:file.sha256;
  const bytes=readFileSync(join(rollbackDirectory?backup:bundle,name));assert.equal(sha(bytes),replacement,'Replacement digest mismatch.');
  return {name,target,expected,replacement,bytes,current:readFileSync(target)};
 });
 if(rows.every(row=>sha(row.current)===row.replacement))return {changed:false,clientRevision:manifest.clientRevision,healthyHostRestarted:false};
 for(const row of rows)assert(sha(row.current)===row.expected||(rollbackDirectory&&sha(row.current)===row.replacement),'Installed client differs. Refusing to overwrite another revision.');
 if(!rollbackDirectory){const backupRoot=dirname(backup);mkdirSync(backupRoot,{recursive:true,mode:0o700});assert(inside(profile,realpathSync(backupRoot)),'Backup directory escapes personal profile.');mkdirSync(backup,{mode:0o700});for(const row of rows)writeFileSync(join(backup,row.name),row.current,{mode:0o600,flag:'wx'});}
 for(const row of rows){
  if(rollbackDirectory&&sha(readFileSync(row.target))===row.replacement)continue;
  assert.equal(sha(readFileSync(row.target)),row.expected,'Client changed during installation.');
  const temp=row.target+'.'+randomUUID()+'.tmp';assert(!existsSync(temp));writeFileSync(temp,row.bytes,{mode:0o644,flag:'wx'});renameSync(temp,row.target);
 }
 return {changed:true,clientRevision:manifest.clientRevision,rollback:!!rollbackDirectory,backupDirectory:backup,healthyHostRestarted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);if(args.length!==1&&!(args.length===3&&args[1]==='--rollback'))throw Error('Usage: node client-overlay.mjs /absolute/personal/profile [--rollback /absolute/backup]');
 assert(isAbsolute(args[0]),'Provide the explicit absolute personal profile directory.');
 console.log(JSON.stringify(applyClientOverlay(dirname(fileURLToPath(import.meta.url)),args[0],args[2]),null,2));
}
