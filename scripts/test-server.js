// Fresh database per server invocation. No reset endpoints are exposed by the app.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const directory = mkdtempSync(join(tmpdir(), 'slotwise-test-'));
const child = spawn(process.execPath, ['src/server.js'], { stdio: 'inherit', env: { ...process.env, DB_PATH: join(directory, 'test.sqlite') } });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { rmSync(directory, { recursive: true, force: true }); process.exit(code || 0); });
