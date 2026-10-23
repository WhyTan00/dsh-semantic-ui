import type { Envelope, Issue } from '../protocol';
export const META='dshSemanticUi' as const;
export interface Checkpoint { turn:number; view?:Envelope; displayId?:string; issues?:Issue[] }
export interface ViewState { turn:number; view?:Envelope; issues?:Issue[] }
