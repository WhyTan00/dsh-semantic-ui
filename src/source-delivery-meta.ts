import {z} from 'zod';
const identity=z.strictObject({displayId:z.string().min(1).max(80),revision:z.number().int().min(1).max(100000),component:z.literal('ArchitectureExplorer')});
const hostContext=z.strictObject({sessionId:z.string().min(1).max(200),turn:z.number().int().nonnegative(),turnStartSeq:z.number().int().nonnegative(),messageId:z.string().min(1).max(160),messageSeq:z.number().int().nonnegative(),producerSourceKind:z.literal('user'),inherited:z.literal(false),excludedSyntheticContexts:z.number().int().nonnegative()}).refine(c=>c.messageSeq>c.turnStartSeq,'Source message must follow the recorded turn start.');
const flags={version:z.literal(1),identityVerified:z.literal(false),sourceFactsVerified:z.literal(false)};
export const sourceDeliverySchema=z.discriminatedUnion('status',[
 z.strictObject({...flags,status:z.literal('bound'),kind:z.literal('permissions-zh'),explanation:z.string().min(1).max(20000),sourceRef:z.strictObject({textSha256:z.string().regex(/^[a-f0-9]{64}$/),hostContext}),viewIdentity:identity}),
 z.strictObject({...flags,status:z.literal('unverified'),code:z.string().min(1).max(80),reason:z.string().min(1).max(500)}),
]);
export type SourceDelivery=z.infer<typeof sourceDeliverySchema>;
