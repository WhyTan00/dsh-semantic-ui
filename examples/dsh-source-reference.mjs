#!/usr/bin/env node
if (process.argv.includes('--help')) {
  console.log('node examples/dsh-source-reference.mjs --archive <local.tgz> --manifest <manifest.json> [--source-file <text> --source-json-pointer </field> --source-kind <kind>] [--case A2|A3|D1|D2|N2|T2] [--check] [--open] [--output <new-private-dir>]\n默认采用六个公开原始输入；只构建受支持来源的程序参考，不生成新模型回答。Ctrl+C关闭本次自有服务。');
} else {
  process.argv.push('--source-reference');
  await import('./dsh-model-history.mjs');
}
