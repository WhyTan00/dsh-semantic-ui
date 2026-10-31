import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sourceReference} from './source-reference.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
export async function loadSourceReferences(core, root, options = {}) {
  if (options.jsonPointer !== undefined && !options.sourceFile) throw Error('JSON pointer requires a source file');
  if (options.sourceFile && options.case) throw Error('Choose a caller source file or an original case');
  const records = options.sourceFile ? [{key: 'caller-source', file: options.sourceFile}] :
    JSON.parse(await readFile(path.join(root, 'fixtures/original-source-cases.json'), 'utf8')).records.filter(r => !options.case || r.key === options.case);
  if (!records.length) throw Error('Unknown original source case');
  const phases = [];
  for (const record of records) {
    const bytes = await readFile(path.resolve(root, record.file));
    let source, original, pointer = null;
    if (options.sourceFile) {
      source = bytes.toString('utf8');
      if (options.jsonPointer !== undefined) {
        source = JSON.parse(source); pointer = options.jsonPointer;
        if (pointer && !pointer.startsWith('/')) throw Error('JSON pointer must be empty or start with /');
        for (const token of pointer ? pointer.slice(1).split('/') : []) source = source[token.replace(/~1/g, '/').replace(/~0/g, '~')];
      }
    } else {original = JSON.parse(bytes); source = original.question; pointer = '/question';}
    if (typeof source !== 'string') throw Error('Selected source must be text');
    const reference = sourceReference(core, source, options.kind);
    if (reference.status === 'refused') throw Error('Reference construction refused: ' + JSON.stringify(reference.issues));
    const legacyCalls = (original?.actualToolCalls ?? []).map((c, index) => ({...c, index,
      parsed: typeof c.arguments === 'string' ? JSON.parse(c.arguments) : c.arguments})).filter(c => c.name === 'dsh_semantic_ui' && c.parsed.action === 'render' && c.parsed.view);
    const legacy = legacyCalls.at(-1);
    phases.push({phase: phases.length + 1, caseKey: record.key, kind: 'source-reference', source, sourceSha256: sha(source),
      reference, render: reference.status === 'ready' ? {action: 'render', ...reference.request} : null,
      legacyRender: legacy?.parsed ?? null,
      finalText: reference.status === 'ready' ? reference.comparison.canonicalExplanation.text :
        '当前完整文字不在已支持的有限来源语法内，本例不生成事实组件，也不把原模型自由正文当作已核事实。缺失状态、零值与统计口径可在有明确读数的参考中核对。',
      origin: {caseKey: record.key, sourceRecord: record.file, sourceRecordSha256: sha(bytes), jsonPointer: pointer,
        selectedTextSha256: sha(source), legacyModelRenderCallIndex: legacy?.index ?? null,
        originalModelFinalSha256: original ? sha(original.finalAnswer) : null,
        referenceAuthorship: 'program-derived from current finite source parser; not an original model candidate or repaired raw answer'}});
  }
  return {phases, newModelStarts: 0, referenceMode: true, fromOriginalCaseCatalog: !options.sourceFile};
}
