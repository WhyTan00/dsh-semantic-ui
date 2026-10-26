import assert from 'node:assert/strict';

export function assertReversedDecision(decision){
 assert.deepEqual(decision.eligibleOptionIds,[]);
 assert.deepEqual(decision.excludedOptionIds,['vm']);
 assert.deepEqual(decision.unknownFeasibilityIds,['hosted']);
 assert.deepEqual(decision.recommendedOptionIds,[]);
 assert.deepEqual(decision.requirements.map(({requirementId,optionId,relation,actual,needed,status})=>({requirementId,optionId,relation,actual,needed,status})),[
  {requirementId:'rq-private',optionId:'hosted',relation:'supports',actual:true,needed:true,status:'pass'},
  {requirementId:'rq-private',optionId:'vm',relation:'supports',actual:false,needed:true,status:'fail'},
  {requirementId:'rq-maint',optionId:'hosted',relation:'requires-availability',actual:null,needed:null,status:'unknown'},
  {requirementId:'rq-maint',optionId:'vm',relation:'requires-availability',actual:true,needed:null,status:'unknown'},
 ]);
}
