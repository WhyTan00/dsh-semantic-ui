import{readFileSync,mkdirSync,writeFileSync}from'node:fs';import{resolve}from'node:path';import{createHash}from'node:crypto';import{spawn,execFileSync}from'node:child_process';
const version=JSON.parse(readFileSync('package.json')).version,dir=resolve('artifacts/releases',version),manifest=JSON.parse(readFileSync(resolve(dir,'package-manifest.json'))),archive=resolve(dir,manifest.filename);
if(manifest.version!==version||manifest.sourceCommit!==execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()||createHash('sha256').update(readFileSync(archive)).digest('hex')!==manifest.sha256)throw Error('Frozen result package/source mismatch');
const carry=resolve('artifacts/local/result-transfer-'+Date.now());mkdirSync(carry,{recursive:true});
for(const phase of ['export','import'])for(const mode of ['native','ptc']){
 const child=spawn(process.execPath,['tests/host-lifecycle.mjs'],{env:{...process.env,INSTALL_PACKAGE:archive,RESULTS_ONLY:'1',SOURCE_HOST_ONLY:'1',RESULT_PHASE:phase,RESULT_CARRY_DIR:carry,TOOL_MODE_ONLY:mode},stdio:'inherit'});const code=await new Promise(r=>child.once('exit',r));if(code!==0)throw Error('Result transfer failed: '+phase+' '+mode+'; inspect retained owned run.');
 if(phase==='import')writeFileSync(resolve(carry,'accepted-'+mode+'.json'),JSON.stringify({version,archiveSha256:manifest.sha256,mode,freshSourceAndDestinationProfiles:true,normalUiRoundTrip:true,modelTurns:0},null,2)+'\n');
}console.log('Result transfer artifacts: '+carry);
