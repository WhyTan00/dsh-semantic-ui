import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
const version=JSON.parse(readFileSync('package.json')).version,dir=resolve('artifacts/releases',version),manifest=JSON.parse(readFileSync(resolve(dir,'package-manifest.json'))),archive=resolve(dir,manifest.filename);
if(manifest.version!==version||manifest.sourceCommit!==execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()||createHash('sha256').update(readFileSync(archive)).digest('hex')!==manifest.sha256)throw Error('Frozen local-form package/source mismatch');
const carry=resolve('artifacts/local/local-form-transfer-'+Date.now());mkdirSync(carry,{recursive:true});
for(const mode of ['native','ptc']){
 const child=spawn(process.execPath,['tests/host-lifecycle.mjs'],{env:{...process.env,INSTALL_PACKAGE:archive,LOCAL_FORM_ONLY:'1',SOURCE_HOST_ONLY:'1',TOOL_MODE_ONLY:mode,FORM_CARRY_DIR:carry},stdio:'inherit'});
 const code=await new Promise(r=>child.once('exit',r));if(code!==0){process.exitCode=code??1;break;}
}
