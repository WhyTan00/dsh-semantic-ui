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

    def assumed_core(self, core=None):
        alternate = copy.deepcopy(core if core is not None else self.core('D'))
        s = alternate['dataFacts']['series'][0]
        s.update({'valid': alternate['dataFacts']['rows'], 'missing': 0, 'mean': 0})
        s['zeroFillIllustration'].update({'mean': 0, 'differenceFromObservedMean': 0,
            'directionRelativeToObservedMean': 'same', 'completeDataMeanKnown': True})
        return alternate

    def run_answer(self, source=None, core=None, mutate_bound=None, alternate_core=None):
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
            if len(calls) == 2:
                self.assertEqual(args['view'], calls[0][1]['view'])
                return {'structuredContent': core}
            self.assertEqual(len(calls), 3)
            self.assertNotEqual(args['view']['displayId'], calls[0][1]['view']['displayId'])
            self.assertIn('假设', args['view']['payload']['title'])
            if alternate_core is None:
                alternate = self.assumed_core(core)
            else:
                alternate = alternate_core
            return {'structuredContent': alternate}
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

    def test_all_missing_uses_separate_assumed_copy_and_keeps_original_unknowns(self):
        answer, calls = self.run_answer(source=self.source('D'), core=self.core('D'))
        self.assertEqual(len(calls), 3)
        self.assertEqual(answer['status'], 'delivered')
        self.assertEqual(answer['hypothesis']['status'], 'available')
        self.assertEqual(answer['hypothesis']['mean'], 0)
        self.assertIsNone(answer['hypothesis']['differenceFromObservedMean'])
        self.assertFalse(answer['hypothesis']['completeDataMeanKnown'])
        self.assertEqual(answer['hypothesis']['directionRelativeToObservedMean'], 'unknown')
        self.assertEqual(answer['hypothesis']['calculationSource'], 'separate-zero-filled-copy')
        self.assertIn('补零假设平均值：0', answer['text'])
        self.assertIn('没有有效实测均值', answer['text'])
        self.assertTrue(all(r['values']['source-readings'] is None for r in calls[0][1]['view']['payload']['rows']))
        self.assertTrue(all(r['values']['source-readings'] == 0 for r in calls[2][1]['view']['payload']['rows']))
        self.assertEqual(calls[0][1]['view']['payload']['unit'], calls[2][1]['view']['payload']['unit'])
        self.assertFalse(client.finite_number(10**1000))

    def test_invalid_original_or_copy_results_never_gain_a_fallback_zero(self):
        bad = self.core('D');bad['dataFacts']['series'][0]['zeroFillIllustration'].pop('mean')
        answer, calls = self.run_answer(source=self.source('D'), core=bad)
        self.assertEqual(answer['status'], 'withheld');self.assertEqual(len(calls), 2)
        for mutate in [lambda r: r['dataFacts'].update({'unit': 'mA'}),
                       lambda r: r['dataFacts']['series'][0].update({'mean': float('inf')}),
                       lambda r: r['dataFacts']['series'][0]['zeroFillIllustration'].pop('count')]:
            alternate = self.assumed_core();mutate(alternate)
            answer, calls = self.run_answer(source=self.source('D'), core=self.core('D'), alternate_core=alternate)
            self.assertEqual(len(calls), 3)
            self.assertEqual(answer['status'], 'withheld')
            self.assertNotIn('补零假设平均值：0', answer['text'])

    def test_non_all_missing_unavailable_result_remains_unknown_without_copy(self):
        source = self.source();source['sourceStatistics']['observed']['mean'] = None
        core = self.core();s = core['dataFacts']['series'][0];s['mean'] = None
        s['zeroFillIllustration'].update({'mean': None, 'differenceFromObservedMean': None,
                                         'directionRelativeToObservedMean': 'unknown'})
        answer, calls = self.run_answer(source=source, core=core)
        self.assertEqual(len(calls), 2)
        self.assertEqual(answer['status'], 'partial')
        self.assertIsNone(answer['hypothesis']['mean'])


if __name__ == '__main__':
    unittest.main()
