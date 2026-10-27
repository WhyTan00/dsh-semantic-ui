import {z} from 'zod';

export const SOURCE_UPDATE_ENDPOINT='dsh-semantic-ui/source-update';
const sha=z.string().regex(/^[a-f0-9]{64}$/),name=z.string().min(1).max(160);
export const sourceUpdateBaseSchema=z.strictObject({
 sessionId:name,turn:z.number().int().nonnegative(),turnStartSeq:z.number().int().nonnegative(),
 messageId:name,messageSeq:z.number().int().nonnegative(),textSha256:sha,
 displayId:z.string().min(1).max(80),revision:z.number().int().positive(),
});
export type SourceUpdateBase=z.infer<typeof sourceUpdateBaseSchema>;
export const sourceUpdateRequestSchema=z.discriminatedUnion('action',[
 z.strictObject({action:z.literal('offer'),base:sourceUpdateBaseSchema}),
 z.strictObject({action:z.literal('submit'),base:sourceUpdateBaseSchema,condition:name,value:z.boolean(),requestId:z.uuid()}),
 z.strictObject({action:z.literal('status'),sessionId:name,requestId:z.uuid()}),
]);
export type SourceUpdateRequest=z.infer<typeof sourceUpdateRequestSchema>;
export interface SourceUpdateResult{
 status:'available'|'withheld'|'unknown'|'message-persisted'|'adopted';code?:string;
 requestId?:string;admission?:'accepted'|'not-confirmed';durable?:boolean;
 asOfSeq?:number;
 base?:SourceUpdateBase;fields?:{condition:string;capabilities:string[];before:string}[];
 change?:{condition:string;from:null;to:boolean;textByteStart:number;textByteEnd:number;before:string;after:string};
 nextTextSha256?:string;message?:{id:string;seq:number;turn:number;turnStartSeq:number;requestId:string;textSha256:string};
 checkpoint?:{seq:number;displayId:string;revision:number;textSha256:string;explanation:string};
 sourceFactsVerified:false;identityVerified:false;freeProseVerified:false;
}
export type SourceUpdateBridge=(request:SourceUpdateRequest)=>Promise<SourceUpdateResult>;
