import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {checkSourceCapacity,CAPACITY_FIELD_LABELS} from '../src/source-capacity';
import {bindCapacityView} from '../src/source-delivery';
import type {SourceSnapshot} from '../src/source-graph';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/capacity-diagnostic-request.json',import.meta.url),'utf8'));
const h=createHash('sha256').update(fixture.source).digest('hex');
const source:SourceSnapshot={kind:'capacity-zh',textSha256:h,excerptSha256:h,textBytes:Buffer.byteLength(fixture.source),textByteStart:0,textByteEnd:Buffer.byteLength(fixture.source),excerpt:fixture.source};
const repaired=()=>{const r=structuredClone(fixture.request);r.view.payload.inputs[0].label=CAPACITY_FIELD_LABELS.inputs[0];return r;};
it('advertises the existing literal numeric contract on source inspection',()=>{
 const r=checkSourceCapacity(source,{});expect(r).toHaveProperty('viewContract.inputs.labels',[...CAPACITY_FIELD_LABELS.inputs]);expect(r).toHaveProperty('viewContract.inputs.initial',180);expect(r).toHaveProperty('viewContract.inputs.unit','MB');expect(r).toHaveProperty('viewContract.inputs.omittedFields',['semanticRole','choices']);
});
it('diagnoses the actual failed model label without falsely calling its correct180MB a current-demand error',()=>{
 const before=JSON.stringify(fixture.request),r=checkSourceCapacity(source,fixture.request),issues=r.issues as any[];
 expect(r.comparison).toHaveProperty('status','mismatch');expect(issues.map(i=>i.code)).toEqual(['SOURCE_INPUT_LABEL']);expect(issues[0].path).toBe('$.view.payload.inputs.0.label');expect(issues[0].reason).toContain('需求容量');expect(r).toHaveProperty('inputChecks.0.status','matched');expect(JSON.stringify(fixture.request)).toBe(before);
});
it('requires an explicit caller repair and still refuses unknown labels, changed quantities or wrong units',()=>{
 const r=repaired();expect(checkSourceCapacity(source,r).comparison).toHaveProperty('status','matched');expect(bindCapacityView(source,r.view,r.mapping).ok).toBe(true);
 for(const label of ['本地容量需求','budget','任意字段']){const wrong=repaired();wrong.view.payload.inputs[0].label=label;expect(checkSourceCapacity(source,wrong)).toHaveProperty('issues.0.code','SOURCE_INPUT_LABEL');}
 const quantity=repaired();quantity.view.payload.inputs[0].initial=600;expect(checkSourceCapacity(source,quantity)).toHaveProperty('issues.0.code','SOURCE_CURRENT_DEMAND');
 const unit=repaired();unit.view.payload.inputs[0].unit='GB';expect(checkSourceCapacity(source,unit).comparison).not.toHaveProperty('status','matched');
});
it('keeps numeric direction and boolean-role refusals while returning the representation contract',()=>{
 const reversed=repaired();reversed.view.payload.requirements[0].relation='at-most';expect(checkSourceCapacity(source,reversed)).toHaveProperty('issues.0.code','SOURCE_CAPACITY_DIRECTION');
 const roles=repaired();roles.view.payload.inputs[0].semanticRole='capability-need';const r=checkSourceCapacity(source,roles);expect(r).toHaveProperty('status','validation-failed');expect(r).toHaveProperty('issues.0.code','ROLE_TYPE');expect(r).toHaveProperty('viewContract.inputs.omittedFields',['semanticRole','choices']);
});
