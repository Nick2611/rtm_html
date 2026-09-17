// B3. Las suites que ya protegen el tracking, la Lambda y la subida de conversiones.
// Se corren sobre el árbol que se valida: si el refactor mueve el módulo, tienen que seguir pasando.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SUITES = [
  { id: 'B3-tests-conversion-tracking', file: 'js/conversion-tracking.test.js', cmd: ['node', ['--test', 'js/conversion-tracking.test.js']] },
  { id: 'B3-tests-lambda', file: 'backend/lambda/send-email', cmd: ['node', ['--test']], cwd: 'backend/lambda/send-email' },
  { id: 'B3-tests-subir-conversiones', file: 'scripts/ads/test_subir_conversiones.py', cmd: ['python3', ['-m', 'unittest', 'scripts/ads/test_subir_conversiones.py']] },
];

export function testChecks({ root, baseline }) {
  return SUITES.flatMap(suite => {
    const present = existsSync(join(root, suite.file));
    const expected = baseline?.tests?.[suite.id];
    if (!present) {
      return [{ id: suite.id, gate: 'contract', status: expected ? 'fail' : 'skip', detail: `${suite.file} no existe${expected ? ' (existía en la línea base)' : ''}` }];
    }
    const run = spawnSync(suite.cmd[0], suite.cmd[1], { cwd: join(root, suite.cwd || ''), encoding: 'utf8', timeout: 180000 });
    const output = `${run.stdout}\n${run.stderr}`;
    const pass = Number(output.match(/^# pass (\d+)/m)?.[1] ?? output.match(/^Ran (\d+) tests?/m)?.[1] ?? 0);
    const ok = run.status === 0;
    const fewer = expected && pass < expected;
    return [{
      id: suite.id, gate: 'contract', status: ok && !fewer ? 'pass' : 'fail', count: pass,
      detail: `${pass} tests ${ok ? 'en verde' : 'CON FALLAS'}${fewer ? ` (la línea base tenía ${expected})` : ''}`,
    }];
  });
}
