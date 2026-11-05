import type {Envelope} from './protocol';
import type {SourceSnapshot} from './source-graph';
export type FiniteReference = {
 status:'ready';kind:NonNullable<SourceSnapshot['kind']>;sourceSha256:string;snapshot:SourceSnapshot;
 parsedSource:unknown;request:{view:Envelope;mapping?:unknown};comparison:Record<string,unknown>;
 referenceAuthorship:string;sourceFactsVerified:false;identityVerified:false;freeProseVerified:false;
}|{status:'unsupported'|'refused';reason?:string;stage?:string;issues?:unknown;sourceSha256?:string};
export function sourceReferenceFromSnapshot(core:typeof import('./core'),snapshot:SourceSnapshot,requestedKind?:SourceSnapshot['kind']):FiniteReference;
