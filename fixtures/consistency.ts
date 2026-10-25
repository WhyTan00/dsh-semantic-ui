import {decision} from './examples';
import {sharedPaths,proposal,resource,inputScope,capacity,capability} from './grounding';
import type {Envelope} from '../src/protocol';
// New declarations are explicitly authored fixture data, never inferred from labels.
export const declaredResource=structuredClone(resource);
if(declaredResource.component!=='DecisionExplorer')throw Error('Decision fixture required');
declaredResource.protocolVersion='1.4';declaredResource.displayId='declared-resource';declaredResource.payload.title='Explicit capability and resource declarations';
declaredResource.payload.dimensions[0].semanticRole='capability-support';declaredResource.payload.dimensions[1].semanticRole='resource-need';
declaredResource.payload.inputs[0].semanticRole='capability-need';declaredResource.payload.inputs[1].semanticRole='resource-available';declaredResource.payload.inputs.forEach(i=>i.expectedEffect='hard');
export const declaredScope=structuredClone(inputScope);
if(declaredScope.component!=='DecisionExplorer')throw Error('Decision fixture required');
declaredScope.protocolVersion='1.4';declaredScope.displayId='declared-scope';declaredScope.payload.title='Expected effects match declared dependencies';declaredScope.payload.inputs[0].expectedEffect='hard';declaredScope.payload.inputs[1].expectedEffect='preference-only';
export const declaredCapacity=structuredClone(capacity);
if(declaredCapacity.component!=='DecisionExplorer')throw Error('Decision fixture required');
declaredCapacity.protocolVersion='1.4';declaredCapacity.payload.inputs.forEach(i=>i.expectedEffect='hard');
export const declaredCapability=structuredClone(capability);
if(declaredCapability.component!=='DecisionExplorer')throw Error('Decision fixture required');
declaredCapability.protocolVersion='1.4';declaredCapability.payload.dimensions[0].semanticRole='capability-support';declaredCapability.payload.inputs[0].semanticRole='capability-need';declaredCapability.payload.inputs[0].expectedEffect='hard';
export const consistencyFixtures:Record<string,Envelope>={resource:declaredResource,scope:declaredScope};

// Current deliveries for the older fixture suites. Historical source objects stay unchanged.
export const declaredDecision=structuredClone(decision);
if(declaredDecision.component!=='DecisionExplorer')throw Error('Decision fixture required');
declaredDecision.protocolVersion='1.4';declaredDecision.payload.inputs[0].expectedEffect='hard-and-preference';
export const declaredProposal=structuredClone(proposal);
if(declaredProposal.component!=='DecisionExplorer')throw Error('Decision fixture required');
declaredProposal.protocolVersion='1.4';declaredProposal.payload.inputs[0].expectedEffect='hard-and-preference';declaredProposal.payload.inputs[1].expectedEffect='hard';declaredProposal.payload.inputs[2].expectedEffect='hard';
export const currentGroundingFixtures={capacity:declaredCapacity,paths:{...sharedPaths,protocolVersion:'1.4' as const},proposal:declaredProposal,capability:declaredCapability,resource:{...declaredResource,payload:{...declaredResource.payload,title:resource.payload.title}},scope:{...declaredScope,payload:{...declaredScope.payload,title:inputScope.payload.title}}};
