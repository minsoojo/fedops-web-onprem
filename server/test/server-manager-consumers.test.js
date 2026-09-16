import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('file settings A/B route existing HTTP and socket handlers to the selected Manager', { timeout: 30000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fedops-consumers-'));
  const received = [[], []];
  const servers = received.map(requests => http.createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    request.resume();
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(request.url.startsWith('/web-control/status/')
      ? { deployment: { replicas: 1, ready_replicas: 1 }, pods: [{ phase: 'Running', ready: true }] }
      : request.url === '/FLSe/startTask' ? { status: 'Task started.' } : { status: 'ok' }));
  }));
  try {
    for (const server of servers) {
      server.listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
    }
    for (let selected = 0; selected < servers.length; selected++) {
      const file = join(directory, 'settings.env');
      writeFileSync(file, `FL_SERVER_MANAGER_URL=http://127.0.0.1:${servers[selected].address().port}\n`);
      const env = { ...process.env, DOTENV_CONFIG_PATH: file };
      delete env.FL_SERVER_MANAGER_URL;
      delete env.SERVER_MANAGER_URL;
      // The fixture is an ordinary application process, not a node:test worker.
      delete env.NODE_TEST_CONTEXT;
      const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/manager-consumers.mjs', import.meta.url))],
        { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { output += chunk; });
      const timer = setTimeout(() => child.kill(), 15000);
      try {
        const code = await new Promise((resolve, reject) => {
          child.once('error', reject); child.once('close', resolve);
        });
        assert.equal(code, 0, output);
      } finally { clearTimeout(timer); }
      assert.deepEqual(received[selected], [
        'GET /web-control/status/test', 'GET /FLSe/GetFLTask/test',
        'GET /FLSe/status/test', 'POST /FLSe/startTask',
      ]);
      if (selected === 0) assert.deepEqual(received[1], []);
      else assert.equal(received[0].length, 4);
    }
  } finally {
    for (const server of servers) await new Promise(resolve => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
