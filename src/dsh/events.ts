import type { Envelope, Issue } from '../protocol';
import type {SourceDelivery} from '../source-delivery-meta';
export const META='dshSemanticUi' as const;
export interface Checkpoint { turn:number; view?:Envelope; displayId?:string; issues?:Issue[];sourceDelivery?:SourceDelivery }
export interface ViewState { turn:number; view?:Envelope; issues?:Issue[];sourceDelivery?:SourceDelivery }
