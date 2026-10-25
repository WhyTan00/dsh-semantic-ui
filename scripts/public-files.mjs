import {relative,resolve,sep} from 'node:path';
// Project OS provenance is private even when stored below the documentation root.
export function publicDocumentation(source,root='docs'){
 const name=relative(resolve(root),resolve(source)).split(sep).join('/');
 return name!=='materials'&&!name.startsWith('materials/');
}
export function privatePackagePath(name){
 return /^(?:\.handoff|actions|docs\/materials)(?:\/|$)/.test(name.replaceAll('\\','/'));
}
