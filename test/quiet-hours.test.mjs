/**
 * Teste da janela de silêncio (matemática pura, sem Chrome).
 * Roda com: node test/quiet-hours.test.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'quiet-hours.js'), 'utf8');

const context = vm.createContext({});
vm.runInContext(source, context, { filename: 'quiet-hours.js' });
const Q = context.DshQuietHours;

const results = [];
function assert(condition, description) {
  results.push({ ok: Boolean(condition), description });
  console.log(`${condition ? 'ok  ' : 'FALHOU'} ${description}`);
  if (!condition) process.exitCode = 1;
}

/** Data local de conveniência: `at(23, 30)`. */
const at = (hours, minutes) => new Date(2026, 9, 21, hours, minutes, 0, 0);

console.log('# interpretação de horários');
assert(Q.parseHHMM('22:00') === 1320, 'aceita HH:MM');
assert(Q.parseHHMM('8:05') === 485, 'aceita uma casa na hora');
assert(Q.parseHHMM('24:00') === null, 'rejeita hora fora do intervalo');
assert(Q.parseHHMM('12:75') === null, 'rejeita minuto fora do intervalo');
assert(Q.parseHHMM('meia-noite') === null, 'rejeita texto livre');

console.log('\n# janela no mesmo dia (09:00 → 17:00)');
assert(Q.inQuietHours(at(10, 0), '09:00', '17:00') === true, 'dentro da janela');
assert(Q.inQuietHours(at(9, 0), '09:00', '17:00') === true, 'no início, inclusivo');
assert(Q.inQuietHours(at(17, 0), '09:00', '17:00') === false, 'no fim, exclusivo');
assert(Q.inQuietHours(at(18, 30), '09:00', '17:00') === false, 'fora da janela');

console.log('\n# janela que atravessa a meia-noite (22:00 → 08:00)');
assert(Q.inQuietHours(at(23, 0), '22:00', '08:00') === true, 'antes da meia-noite');
assert(Q.inQuietHours(at(3, 0), '22:00', '08:00') === true, 'depois da meia-noite');
assert(Q.inQuietHours(at(7, 59), '22:00', '08:00') === true, 'um minuto antes do fim');
assert(Q.inQuietHours(at(8, 0), '22:00', '08:00') === false, 'exatamente no fim');
assert(Q.inQuietHours(at(12, 0), '22:00', '08:00') === false, 'meio do dia');

console.log('\n# casos degenerados');
assert(Q.inQuietHours(at(12, 0), '22:00', '22:00') === false, 'início igual ao fim desliga o silêncio');
assert(Q.inQuietHours(at(12, 0), 'x', '08:00') === false, 'horário inválido não silencia');
assert(Q.inQuietHours(at(12, 0), '22:00', '99:99') === false, 'fim inválido não silencia');

console.log('\n# quanto falta para a janela acabar');
assert(Q.minutesUntilEnd(at(23, 0), '22:00', '08:00') === 540, 'a meia-noite conta como 9h');
assert(Q.minutesUntilEnd(at(7, 0), '22:00', '08:00') === 60, 'uma hora antes do fim');
assert(Q.minutesUntilEnd(at(12, 0), '22:00', '08:00') === 0, 'fora da janela são zero minutos');
assert(Q.minutesUntilEnd(at(10, 0), '09:00', '17:00') === 420, 'sete horas até o fim');

console.log('\n# quem pode furar o silêncio');
const bypassOn = { quietBypassApproval: true };
const bypassOff = { quietBypassApproval: false };
assert(Q.bypasses('approval', bypassOn) === true, 'aprovação fura por padrão');
assert(Q.bypasses('question', bypassOn) === false, 'pergunta espera');
assert(Q.bypasses('plan', bypassOn) === false, 'revisão de plano espera');
assert(Q.bypasses('approval', bypassOff) === false, 'desligado, nem aprovação fura');

const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
