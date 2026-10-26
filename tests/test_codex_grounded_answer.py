import importlib.util
from pathlib import Path
import unittest

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
