import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';

/** Local deterministic transport for already saved model arguments. Never calls a provider. */
export async function startReplayServer(planFile, output) {
  await mkdir(output, {recursive: true, mode: 0o700});
  let sequence = 0;
  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({object: 'list', data: [{id: 'saved-model-replay', object: 'model', owned_by: 'local-saved-result-replay'}]}));
        return;
      }
      if (req.url !== '/v1/chat/completions' || req.method !== 'POST') {res.writeHead(404).end(); return;}
      let body = '';
      for await (const chunk of req) body += chunk;
      const request = JSON.parse(body), plan = JSON.parse(await readFile(planFile, 'utf8'));
      const currentAt = request.messages.findLastIndex(m => m.role === 'user' && JSON.stringify(m.content).includes(plan.source));
      if (currentAt < 0) throw Error('Replay request has no matching current complete source');
      const toolCount = request.messages.slice(currentAt + 1).filter(m => m.role === 'tool').length;
      const n = ++sequence;
      await writeFile(path.join(output, `${plan.key}-${n}.json`), JSON.stringify(request, null, 2), {mode: 0o600});
      const toolNames = request.tools?.map(t => t.function?.name) ?? [];
      if (!toolNames.includes('dsh_semantic_ui')) throw Error('This saved example claims Native tools only');
      const base = {id: `saved-replay-${n}`, object: 'chat.completion.chunk', created: Math.floor(Date.now()/1000), model: 'saved-model-replay'};
      res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive'});
      const send = (delta, finish_reason = null) => res.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason}]}) + '\n\n');
      if (toolCount >= plan.argsSequence.length) {
        send({role: 'assistant', content: `已保存模型结果的呈现回放 · 第${plan.phase}版 · 本次0新增模型\n\n${plan.rawFinal}\n\n回放完成：${plan.key}。上述为既有模型原文，任意正文与世界事实未认证。`});
        send({}, 'stop');
      } else {
        const args = plan.argsSequence[toolCount];
        send({role: 'assistant', tool_calls: [{index: 0, id: `saved-call-${n}`, type: 'function',
          function: {name: 'dsh_semantic_ui', arguments: JSON.stringify(args)}}]});
        send({}, 'tool_calls');
      }
      res.end('data: [DONE]\n\n');
    } catch (error) {
      if (!res.headersSent) res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: {message: error.message}}));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {server, port: server.address().port, requestCount: () => sequence};
}
