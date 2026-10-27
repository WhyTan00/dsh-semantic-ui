import{readFileSync}from'node:fs';import{resolve,basename}from'node:path';import{createHash}from'node:crypto';import{spawn,execFileSync}from'node:child_process';
const version=JSON.parse(readFileSync('package.json')).version,dir=resolve('artifacts/releases',version),manifest=JSON.parse(readFileSync(resolve(dir,'package-manifest.json')));
if(manifest.version!==version||basename(manifest.filename)!==manifest.filename||manifest.sourceCommit!==execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim())throw Error('Frozen cold package/source identity mismatch');
const archive=resolve(dir,manifest.filename);if(createHash('sha256').update(readFileSync(archive)).digest('hex')!==manifest.sha256)throw Error('Cold archive SHA mismatch');
const child=spawn(process.execPath,['tests/cold-source-lifecycle.mjs'],{env:{...process.env,INSTALL_PACKAGE:archive},stdio:'inherit'});const code=await new Promise(r=>child.once('exit',r));process.exitCode=code??1;
