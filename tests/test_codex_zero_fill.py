import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('zero_fill_client', Path(__file__).parents[1]/'examples/codex-readonly.py')
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)
expected = json.loads((Path(__file__).parents[1]/'fixtures/zero-fill-answer/expectations.json').read_text())


class ZeroFillAnswerContracts(unittest.TestCase):
    def source(self, case='C'):
        e = next(c for c in expected['cases'] if c['id'] == case)
        source = {'textSha256': e['sourceSha256'], 'documentSha256': e['sourceSha256'],
                  'excerptSha256': e['sourceSha256'], 'jsonPointer': None,
                  'selection': {'textUTF8ByteStart': 0, 'textUTF8ByteEnd': len(e['source'].encode()),
                                'textUTF8Bytes': len(e['source'].encode())}, 'identityVerified': False}
        return {'status': 'compared', 'sourceCheckKind': 'observations-zh',
                'source': source, 'sourceFactsVerified': False,
                'canonicalExplanation': {'status': 'available', 'text': '原始完整均值未知；实测与缺失保持。'},
                'sourceObservations': {'context': '合成样本', 'measurement': e['measurement'], 'unit': e['unit'],
                                       'positions': [{'index': i, 'value': v} for i, v in enumerate(e['values'])]},
                'sourceStatistics': {'unit': e['unit'], 'observed': {**e['observed'], 'missing': len(e['values'])-e['observed']['count']},
                                     'complete': e['complete']}, 'comparison': {'status': 'not-requested'}}

    def core(self, case='C'):
        e = next(c for c in expected['cases'] if c['id'] == case)
        z = e['zeroFillHypothesis']
        # Frozen16's all-missing core reports no finite hypothesis; never replace it by the mathematical target 0.
        return {'status': 'validated', 'component': 'DataChart', 'sourceFactsVerified': False,
                'dataFacts': {'scope': 'original-full-data', 'chartType': 'bar', 'order': 'input',
                              'unit': e['unit'], 'rows': len(e['values']),
                              'series': [{'id': 'source-readings', 'valid': e['observed']['count'],
                                          'missing': len(e['values'])-e['observed']['count'], 'mean': e['observed']['mean'],
                                          'zeroFillIllustration': {'assumption': 'Only nulls hypothetically become zero.',
                                              'count': z['count'], 'mean': z['mean'] if case == 'C' else None,
                                              'differenceFromObservedMean': z['differenceFromObservedMean'],
                                              'directionRelativeToObservedMean': z['directionRelativeToObservedMean'],
                                              'completeDataMeanKnown': False}}]}}

    def run_answer(self, source=None, core=None, mutate_bound=None):
        source = source or self.source()
        core = core or self.core()
        original = copy.deepcopy(source)
        calls = []
        def tool(name, args):
            calls.append((name, copy.deepcopy(args)))
            if name == 'semantic_ui_source_check':
                bound = copy.deepcopy(source)
                bound['comparison']['status'] = 'matched'
                if mutate_bound:
                    mutate_bound(bound)
                return {'structuredContent': bound}
            self.assertEqual(name, 'semantic_ui_check')
            self.assertEqual(args['view'], calls[0][1]['view'])
            return {'structuredContent': core}
        identity = {k: v for k, v in source['source'].items() if k != 'identityVerified'}
        with tempfile.TemporaryDirectory() as directory:
            answer = client.zero_fill_answer(source, original['source']['textSha256'], identity, tool, Path(directory))
        self.assertEqual(source, original)
        return answer, calls

    def test_source_is_fully_bound_before_existing_core_calculation_and_never_imputed(self):
        answer, calls = self.run_answer()
        self.assertEqual([c[0] for c in calls], ['semantic_ui_source_check', 'semantic_ui_check'])
        source_values = next(c for c in expected['cases'] if c['id'] == 'C')['values']
        projection = calls[0][1]
        self.assertEqual([r['values']['source-readings'] for r in projection['view']['payload']['rows']], source_values)
        self.assertEqual([r['sourceIndex'] for r in projection['mapping']['rows']], list(range(8)))
        self.assertEqual(answer['status'], 'delivered')
        self.assertEqual(answer['hypothesis']['mean'], 1)
        self.assertEqual(answer['hypothesis']['count'], 8)
        self.assertEqual(answer['hypothesis']['differenceFromObservedMean'], -1)
        self.assertRegex(answer['text'], r'补零假设平均值：1(?:\.0)? 毫安')
        for text in ['分母为8', '假设减实测', '原始完整均值未知', '偏差方向']:
            self.assertIn(text, answer['text'])
        for key in ['sourceFactsVerified', 'identityVerified', 'freeProseVerified', 'modelCandidateUsed']:
            self.assertFalse(answer[key])

    def test_source_identity_change_and_unmatched_view_prevent_statistic_call(self):
        for mutate in [lambda r: r['source'].update({'excerptSha256': 'changed'}),
                       lambda r: r['comparison'].update({'status': 'mismatch'}),
                       lambda r: r['source'].update({'identityVerified': True})]:
            answer, calls = self.run_answer(mutate_bound=mutate)
            self.assertEqual(len(calls), 1)
            self.assertEqual(answer['status'], 'withheld')
            self.assertEqual(answer['hypothesis']['status'], 'withheld')
        source = self.source();source['sourceObservations']['positions'][0]['value'] = True
        answer, calls = self.run_answer(source=source)
        self.assertEqual(calls, [])
        self.assertEqual(answer['status'], 'withheld')

    def test_wrong_scope_unit_count_or_missing_nonfinite_numbers_never_yield_a_hypothesis(self):
        mutations = [lambda r: r.update({'sourceFactsVerified': True}),
                     lambda r: r['dataFacts'].update({'scope': 'filtered', 'unit': 'mA'}),
                     lambda r: r['dataFacts'].update({'rows': 7}),
                     lambda r: r['dataFacts']['series'][0].update({'id': 'another'}),
                     lambda r: r['dataFacts']['series'][0]['zeroFillIllustration'].pop('mean'),
                     lambda r: r['dataFacts']['series'][0]['zeroFillIllustration'].update({'mean': False}),
                     lambda r: r['dataFacts']['series'][0]['zeroFillIllustration'].update({'mean': float('inf')}),
                     lambda r: r['dataFacts']['series'][0]['zeroFillIllustration'].update({'count': True}),
                     lambda r: r['dataFacts']['series'][0]['zeroFillIllustration'].pop('differenceFromObservedMean')]
        for mutate in mutations:
            receipt = self.core();mutate(receipt)
            answer, _ = self.run_answer(core=receipt)
            self.assertEqual(answer['status'], 'withheld')
            self.assertEqual(answer['hypothesis']['status'], 'withheld')
            self.assertNotIn('补零假设平均值：', answer['text'])

    def test_all_missing_or_unavailable_core_stays_unknown_without_guessing_zero(self):
        answer, calls = self.run_answer(source=self.source('D'), core=self.core('D'))
        self.assertEqual(len(calls), 2)
        self.assertEqual(answer['status'], 'partial')
        self.assertEqual(answer['hypothesis']['status'], 'unknown')
        self.assertIsNone(answer['hypothesis']['mean'])
        self.assertIsNone(answer['hypothesis']['differenceFromObservedMean'])
        self.assertFalse(answer['hypothesis']['completeDataMeanKnown'])
        self.assertIn('现有核心未提供有限计算值', answer['text'])
        self.assertNotIn('补零假设平均值：0', answer['text'])
        self.assertFalse(client.finite_number(10**1000))


if __name__ == '__main__':
    unittest.main()
