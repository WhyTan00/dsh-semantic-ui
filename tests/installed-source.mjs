import{readFileSync}from'node:fs';import{resolve,basename}from'node:path';import{createHash}from'node:crypto';import{spawn,execFileSync}from'node:child_process';
const version=JSON.parse(readFileSync('package.json')).version,dir=resolve('artifacts/releases',version),manifest=JSON.parse(readFileSync(resolve(dir,'package-manifest.json')));
if(manifest.version!==version||basename(manifest.filename)!==manifest.filename||!/^[a-f0-9]{40}$/.test(manifest.sourceCommit))throw Error('Manifest source identity mismatch');
if(manifest.sourceCommit!==execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim())throw Error('Install suite must match the frozen source commit');
const archive=resolve(dir,manifest.filename);if(createHash('sha256').update(readFileSync(archive)).digest('hex')!==manifest.sha256)throw Error('Archive SHA mismatch');
const child=spawn(process.execPath,['tests/host-lifecycle.mjs'],{env:{...process.env,INSTALL_PACKAGE:archive,SOURCE_HOST_ONLY:'1',DECISION_DELIVERY_ONLY:'1'},stdio:'inherit'});const code=await new Promise(r=>child.once('exit',r));process.exitCode=code??1;
