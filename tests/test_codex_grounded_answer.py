import importlib.util
from pathlib import Path
import unittest
import json

spec = importlib.util.spec_from_file_location('semantic_client',Path(__file__).parents[1]/'examples/codex-readonly.py')
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class GroundedAnswerContracts(unittest.TestCase):
    def source(self, text='方案紫：价格未知；责任未声明。'):
        return {'status':'compared','source':{'textSha256':'a'*64,'documentSha256':'b'*64,
                'identityVerified':False},'sourceFactsVerified':False,
                'canonicalExplanation':{'status':'available','text':text}}

    def test_host_delivery_preserves_opaque_checker_explanation_and_never_uses_candidate(self):
        for text in ['方案紫：价格未知；责任未声明。','节点Q → R；权限未声明。']:
            result=client.grounded_delivery(self.source(text),'a'*64)
            self.assertEqual(result['status'],'delivered')
            self.assertIn(text,result['text'])
            self.assertFalse(result['modelCandidateUsed'])
            self.assertFalse(result['freeProseVerified'])
            self.assertFalse(result['sourceFactsVerified'])
            self.assertFalse(result['identityVerified'])
            self.assertEqual(result['sourceDocumentSha256'],'b'*64)

    def test_source_mismatch_unsupported_and_false_authority_withhold_the_final(self):
        bad=[]
        value=self.source();value['source']['textSha256']='c'*64;bad.append(value)
        value=self.source();value['status']='source-unsupported';bad.append(value)
        value=self.source();value['canonicalExplanation']['status']='withheld';bad.append(value)
        value=self.source();value['source']['identityVerified']=True;bad.append(value)
        value=self.source();value['sourceFactsVerified']=True;bad.append(value)
        for value in bad:
            result=client.grounded_delivery(value,'a'*64)
            self.assertEqual(result['status'],'withheld')
            self.assertNotIn('方案紫',result['text'])

    def test_numeric_refusal_shows_existing_positions_ranges_and_denominators(self):
        receipt=json.loads((Path(__file__).parents[1]/'docs/evidence/source-numeric/zero-fill.json').read_text())
        source=receipt['sourceCheck'];result=client.grounded_delivery(source,source['source']['textSha256'])
        self.assertEqual(result['status'],'withheld')
        for text in ['第3个位置','来源为缺失，收到0','已观测均值声明','分母3','分母4','完整均值声明','来源未知']:
            self.assertIn(text,result['text'])
        self.assertNotIn('模型候选',result['text'])
        for key in ['sourceFactsVerified','identityVerified','freeProseVerified','modelCandidateUsed']:self.assertFalse(result[key])

    def test_refusal_formatting_generalizes_and_never_echoes_prose_paths_or_ids(self):
        source=self.source();source['canonicalExplanation']['status']='withheld';source['sourceCheckKind']='observations-zh'
        source['comparison']={'rowChecks':[{'status':'mismatch','sourceIndex':6,'expected':1.25,'actual':9,'rowId':'PRIVATE_NATIVE_ID'}]}
        source['claimChecks']=[{'status':'mismatch','kind':'mean','population':'complete','expected':{'value':None,'unit':'伏','denominator':5},'actual':{'value':4.5,'unit':'/Users/private/secret','denominator':4}}]
        source['prose']='DO_NOT_ECHO';source['issues']=[{'code':'SOURCE_VALUE','reason':'DO_NOT_ECHO /Users/private/path'}]
        result=client.grounded_delivery(source,'a'*64)
        for text in ['第7个位置','来源为1.25，收到9','完整均值声明','来源未知','分母5']:self.assertIn(text,result['text'])
        for text in ['PRIVATE_NATIVE_ID','DO_NOT_ECHO','/Users/']:self.assertNotIn(text,result['text'])
        source['comparison']['rowChecks']*=40;source['claimChecks']*=40
        result=client.grounded_delivery(source,'a'*64);self.assertLess(len(result['text']),900);self.assertIn('其余拒绝项未展开',result['text'])
        source['source']['textSha256']='wrong';self.assertNotIn('第7个位置',client.grounded_delivery(source,'a'*64)['text'])

    def rpc_without_process(self, enabled):
        value=client.CodexRpc.__new__(client.CodexRpc)
        value.allow_answer=enabled;value.model_turn_requests=0
        value.owned_thread='own';value.active_turn=None
        value.sequence=0;value.sent_methods=[]
        value._send=lambda message: (_ for _ in ()).throw(ConnectionAbortedError('before transport'))
        return value

    def test_default_and_wrong_thread_cannot_send_inference_or_config_writes(self):
        for enabled,thread in [(False,'own'),(True,'another')]:
            rpc=self.rpc_without_process(enabled)
            with self.assertRaises(ValueError):rpc.call('turn/start',{'threadId':thread,'input':[]})
            self.assertEqual(rpc.model_turn_requests,0)
        with self.assertRaises(ValueError):self.rpc_without_process(True).call('config/value/write',{})

    def test_opt_in_budget_is_consumed_before_transport_and_never_retries(self):
        rpc=self.rpc_without_process(True)
        with self.assertRaises(ConnectionAbortedError):rpc.call('turn/start',{'threadId':'own','input':[]})
        self.assertEqual(rpc.model_turn_requests,1)
        with self.assertRaises(ValueError):rpc.call('turn/start',{'threadId':'own','input':[]})


if __name__=='__main__':unittest.main()
