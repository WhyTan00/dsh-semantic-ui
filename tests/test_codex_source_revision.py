import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import tomllib
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location('revision_client', Path(__file__).parents[1] / 'examples/codex-readonly.py')
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class SourceRevisionContracts(unittest.TestCase):
    def args(self, manifest):
        return SimpleNamespace(revision_file=manifest, answer=True, requests_file=None, hypothesis=None,
                               log_dir=manifest.parent/'private-log',
                               source_file=Path('original.txt'), question_file=Path('original-question.txt'),
                               source_json_pointer=None, question_json_pointer=None, source_excerpt=None)

    def test_revision_paths_resolve_from_manifest_and_question_stays_independent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'new.json').write_text(json.dumps({'source': '新来源；当前未知。'}, ensure_ascii=False))
            (root / 'ask.txt').write_text('按新来源更新解释。')
            manifest = root / 'revision.json'
            manifest.write_text(json.dumps({'sourceFile': 'new.json', 'questionFile': 'ask.txt', 'sourceJsonPointer': '/source'}))
            original = self.args(manifest)
            revised = client.revision_inputs(original)
            question, source_sha, identities = client.answer_inputs(revised)
            self.assertEqual(question, '按新来源更新解释。')
            self.assertEqual(source_sha, client.sha('新来源；当前未知。'.encode()))
            self.assertNotEqual(source_sha, identities['questionSha256'])
            self.assertEqual(original.source_file, Path('original.txt'))
            self.assertIsNone(revised.revision_file)

    def test_revision_does_not_accept_prefilled_history_views_or_ambiguous_modes(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / 'revision.json'
            for extra in [{'history': []}, {'view': {}}, {'questionFile': None}]:
                manifest.write_text(json.dumps({'sourceFile': 'new.txt', 'questionFile': 'ask.txt', **extra}))
                with self.assertRaises(ValueError):
                    client.revision_inputs(self.args(manifest))
            manifest.write_text(json.dumps({'sourceFile': 'new.txt', 'questionFile': 'ask.txt'}))
            for setting, value in [('answer', False), ('log_dir', None), ('requests_file', Path('batch.json')), ('hypothesis', 'zero-fill')]:
                args = self.args(manifest)
                setattr(args, setting, value)
                with self.assertRaises(ValueError):
                    client.revision_inputs(args)

    def rpc_without_transport(self):
        rpc = client.CodexRpc.__new__(client.CodexRpc)
        rpc.allow_answer = True
        rpc.allow_revision = True
        rpc.maximum_model_turns = 2
        rpc.model_turn_requests = 0
        rpc.owned_thread = 'owned'
        rpc.active_turn = None
        rpc.sequence = 0
        rpc.sent_methods = []
        rpc._send = lambda value: (_ for _ in ()).throw(ConnectionAbortedError('transport failed'))
        return rpc

    def test_second_attempt_is_bounded_and_failed_transport_consumes_each_slot(self):
        rpc = self.rpc_without_transport()
        for used in [1, 2]:
            with self.assertRaises(ConnectionAbortedError):
                rpc.call('turn/start', {'threadId': 'owned', 'input': []})
            self.assertEqual(rpc.model_turn_requests, used)
        with self.assertRaises(ValueError):
            rpc.call('turn/start', {'threadId': 'owned', 'input': []})
        self.assertEqual(rpc.model_turn_requests, 2)

    def test_no_overlapping_turn_reload_or_fabricated_history(self):
        rpc = self.rpc_without_transport()
        rpc.active_turn = 'active'
        for method, params in [('turn/start', {'threadId': 'owned', 'input': []}), ('config/mcpServer/reload', None)]:
            with self.assertRaises(ValueError):
                rpc.call(method, params)
        rpc.active_turn = None
        for method, params in [('thread/resume', {'threadId': 'owned', 'history': []}),
                               ('thread/fork', {'threadId': 'owned'}), ('thread/inject_items', {}),
                               ('config/value/write', {}), ('config/mcpServer/reload', {})]:
            with self.assertRaises(ValueError):
                rpc.call(method, params)
        rpc.allow_revision = False
        with self.assertRaises(ValueError):
            rpc.call('config/mcpServer/reload', None)

    def test_budget_records_startup_failure_and_cannot_reset_or_add_third(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            client.reserve_candidate(root, 2, 1, 'before startup')
            client.reserve_candidate(root, 2, 2, 'before next turn')
            before = (root / 'candidate-budget.json').read_bytes()
            with self.assertRaises(ValueError):
                client.reserve_candidate(root, 2, 3, 'retry')
            with self.assertRaises(ValueError):
                client.reserve_candidate(root, 3, 3, 'reset')
            self.assertEqual((root / 'candidate-budget.json').read_bytes(), before)

    def test_generated_project_configuration_contains_only_owned_server(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            settings = {'command': 'node', 'args': ['tap.mjs', 'first.json'], 'enabled': True}
            first = client.local_mcp_config(root, 'owned', settings)
            second = client.local_mcp_config(root, 'owned', {**settings, 'args': ['tap.mjs', 'second.json']})
            self.assertNotEqual(first, second)
            parsed = tomllib.loads((root / '.codex/config.toml').read_text())
            self.assertEqual(set(parsed), {'mcp_servers'})
            self.assertEqual(set(parsed['mcp_servers']), {'owned'})
            self.assertEqual(parsed['mcp_servers']['owned']['args'], ['tap.mjs', 'second.json'])
            self.assertFalse((root / '.codex/config.toml.tmp').exists())

    def source(self, source_sha):
        return {'status': 'compared', 'source': {'textSha256': source_sha, 'documentSha256': source_sha,
                'identityVerified': False}, 'sourceFactsVerified': False,
                'canonicalExplanation': {'status': 'available', 'text': '当前有限来源说明。'}}

    def transition(self, root, returned_sha, previous):
        workspace = root / 'workspace'
        workspace.mkdir()
        logs = root / 'revision'
        logs.mkdir()
        source = root / 'new.txt'
        source.write_text('新完整来源')
        args = SimpleNamespace(source_file=source, source_kind='decision-zh', source_json_pointer=None, source_excerpt=None)
        tap_config = root / 'tap-config.json'
        client.write_json(tap_config, {'args': ['old'], 'entry': 'archived-entry', 'log': 'owned-log'})
        calls = []
        rpc = SimpleNamespace(active_turn=None, call=lambda method, params: calls.append((method, params)) or {})

        def tool(name, arguments):
            calls.append((name, copy.deepcopy(arguments)))
            if arguments:
                return {'structuredContent': {'comparison': {'status': 'mismatch'}}}
            return {'structuredContent': self.source(returned_sha)}

        result = client.revise_source(rpc, 'same-owned', 'owned', workspace, {'command': 'node'},
            root / 'tap.mjs', tap_config, args, tool, 'new-sha', None, previous, logs)
        return result, calls

    def test_reload_ack_with_old_source_withholds_revision_and_does_not_check_old_view(self):
        with tempfile.TemporaryDirectory() as directory:
            result, calls = self.transition(Path(directory), 'old-sha', [{'view': {'old': True}}])
            self.assertEqual(result['status'], 'source-not-current')
            self.assertEqual(result['previousViewComparisons'], [])
            self.assertEqual(calls, [('config/mcpServer/reload', None), ('semantic_ui_source_check', {})])

    def test_confirmed_new_source_checks_real_prior_view_without_supplying_source_as_argument(self):
        with tempfile.TemporaryDirectory() as directory:
            old = {'view': {'old': True}, 'mapping': {'dimensions': []}}
            result, calls = self.transition(Path(directory), 'new-sha', [old])
            self.assertEqual(result['status'], 'ready')
            self.assertEqual(result['threadId'], 'same-owned')
            self.assertEqual(result['previousViewComparisons'][0]['request'], old)
            self.assertEqual(calls[-1], ('semantic_ui_source_check', old))
            self.assertNotIn('source', calls[1][1])


if __name__ == '__main__':
    unittest.main()
