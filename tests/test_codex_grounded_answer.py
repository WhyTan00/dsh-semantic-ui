import importlib.util
from pathlib import Path
import unittest
import json
import tempfile
from types import SimpleNamespace

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

    def test_independent_question_cannot_replace_source_identity_and_default_stays_compatible(self):
        with tempfile.TemporaryDirectory() as directory:
            source=Path(directory)/'source.json';question=Path(directory)/'question.txt'
            source.write_text(json.dumps({'reading':'合成来源；未知值保留。'},ensure_ascii=False))
            question.write_text('这份来源支持什么结论？')
            args=SimpleNamespace(source_file=source,source_json_pointer='/reading',source_excerpt=None,
                                 question_file=question,question_json_pointer=None)
            text,source_sha,identity=client.answer_inputs(args)
            self.assertEqual(text,question.read_text())
            self.assertEqual(source_sha,client.sha('合成来源；未知值保留。'.encode()))
            self.assertNotEqual(source_sha,identity['questionSha256'])
            self.assertTrue(identity['questionSeparateFromSource'])
            self.assertFalse(identity['sourceFactsVerified']);self.assertFalse(identity['identityVerified'])
            args.question_file=None
            text,default_sha,identity=client.answer_inputs(args)
            self.assertEqual(text,'合成来源；未知值保留。');self.assertEqual(default_sha,source_sha)
            self.assertFalse(identity['questionSeparateFromSource'])
            args.source_excerpt='未知值保留。'
            text,excerpt_sha,identity=client.answer_inputs(args)
            self.assertEqual(text,'合成来源；未知值保留。')
            self.assertEqual(excerpt_sha,source_sha)
            self.assertEqual(identity['expectedSource']['excerptSha256'],client.sha('未知值保留。'.encode()))
            self.assertEqual(identity['expectedSource']['selection']['textUTF8ByteStart'],len('合成来源；'.encode()))

    def test_same_text_hash_cannot_substitute_a_different_document_or_selection_scope(self):
        expected={'documentSha256':'b'*64,'textSha256':'a'*64,'excerptSha256':'c'*64,
                  'jsonPointer':'/reading','selection':{'textUTF8Bytes':20,'textUTF8ByteStart':4,'textUTF8ByteEnd':16}}
        result=self.source();result['source'].update(expected)
        self.assertEqual(client.grounded_delivery(result,'a'*64,expected)['status'],'delivered')
        for key in ['documentSha256','excerptSha256','jsonPointer','selection']:
            bad=json.loads(json.dumps(result));bad['source'][key]='changed'
            self.assertEqual(client.grounded_delivery(bad,'a'*64,expected)['status'],'withheld')

    def test_separate_question_reaches_one_turn_but_post_source_change_still_withholds(self):
        class Rpc:
            def __init__(self):
                self.calls=[];self.events=client.queue.Queue();self.active_turn=None
            def call(self,method,payload):
                self.calls.append((method,payload))
                self.events.put({'method':'item/completed','params':{'threadId':'own','turnId':'turn',
                    'item':{'id':'message','type':'agentMessage','phase':'final_answer','text':'unverified free prose'}}})
                self.events.put({'method':'turn/completed','params':{'threadId':'own',
                    'turn':{'id':'turn','status':'completed'}}})
                return {'turn':{'id':'turn'}}
        with tempfile.TemporaryDirectory() as directory:
            logs=Path(directory);rpc=Rpc();before=self.source();after=self.source()
            after['source']['textSha256']='changed source'
            result=client.one_answer_turn(rpc,'own',logs/'SKILL.md',b'generic skill',
                'A different ordinary question','a'*64,before,
                lambda name,args:{'structuredContent':after},logs)
            self.assertEqual(result['observedModelTurns'],1)
            self.assertEqual(rpc.calls[0][1]['input'][0]['text'],'A different ordinary question')
            self.assertEqual(rpc.calls[0][1]['input'][1]['type'],'skill')
            self.assertEqual(result['candidate'],'unverified free prose')
            self.assertEqual(result['delivery']['status'],'withheld')
            self.assertNotIn('unverified free prose',(logs/'answer.md').read_text())
            self.assertEqual((logs/'model-candidate.md').read_text(),'unverified free prose')
            inputs=json.loads((logs/'turn-input.json').read_text())
            self.assertEqual(inputs['sourceTextSha256'],'a'*64)
            self.assertNotEqual(inputs['questionSha256'],inputs['sourceTextSha256'])

    def test_wrong_source_hash_refuses_before_model_even_with_a_valid_question(self):
        with tempfile.TemporaryDirectory() as directory:
            calls=[];rpc=SimpleNamespace(call=lambda *args:calls.append(args))
            result=client.one_answer_turn(rpc,'own',Path(directory)/'SKILL.md',b'generic skill',
                'ordinary question','wrong source hash',self.source(),None,Path(directory))
            self.assertEqual(calls,[]);self.assertEqual(result['observedModelTurns'],0)
            self.assertEqual(result['delivery']['status'],'withheld')

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
