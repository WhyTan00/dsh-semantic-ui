import {sourceAlignedD1} from './source-decision';
export function annotatedDecision(revision=1){
 const v=sourceAlignedD1();if(v.component!=='DecisionExplorer')throw Error();v.revision=revision;
 v.summary='UNVERIFIED_CHEAPER_WINNER_AND_MIGRATION_ADVANTAGE';v.payload.title='UNVERIFIED_BEST_PLATFORM';
 for(const o of v.payload.options){o.advantages=['UNVERIFIED_BENEFIT'];o.disadvantages=['UNVERIFIED_COST'];o.suitableWhen='UNVERIFIED_PREFERRED_OPTION';o.evidence=['UNVERIFIED_PROOF'];}return v;
}
