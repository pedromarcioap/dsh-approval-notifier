/**
 * Janela de silêncio (horário de não perturbar).
 *
 * Script clássico, carregado pelo service worker com `importScripts` e também
 * pelos testes num contexto `vm`. Publica as funções em
 * `globalThis.DshQuietHours` para não depender de módulos ES.
 *
 * Decisões (inspiradas na discussão deepseek-ai/deepseek-harness#7569):
 *  - o horário é conferido no momento do envio, não no evento — um lembrete
 *    atrasado não pode furar a janela;
 *  - a janela pode atravessar a meia-noite (22:00 → 08:00);
 *  - aprovação que bloqueia o agente pode furar a janela (configurável),
 *    tarefa concluída não.
 */

(() => {
  const DEFAULTS = {
    quietEnabled: false,
    quietStart: '22:00',
    quietEnd: '08:00',
    quietBypassApproval: true,
  };

  function parseHHMM(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
    if (match === null) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function minutesOfDay(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function inQuietHours(date, start, end) {
    const from = parseHHMM(start);
    const to = parseHHMM(end);
    if (from === null || to === null) return false;
    // Janela vazia significa "sem silêncio", não "o dia inteiro".
    if (from === to) return false;
    const now = minutesOfDay(date);
    return from < to ? now >= from && now < to : now >= from || now < to;
  }

  /** Minutos até a janela acabar; 0 quando não estamos nela. */
  function minutesUntilEnd(date, start, end) {
    if (!inQuietHours(date, start, end)) return 0;
    const to = parseHHMM(end);
    if (to === null) return 0;
    let difference = to - minutesOfDay(date);
    if (difference <= 0) difference += 24 * 60;
    return difference;
  }

  /**
   * Uma aprovação que trava o agente vale acordar; pergunta e revisão de plano
   * esperam a janela terminar.
   */
  function bypasses(kind, settings) {
    if (!settings.quietBypassApproval) return false;
    return kind === 'approval';
  }

  globalThis.DshQuietHours = {
    DEFAULTS,
    parseHHMM,
    minutesOfDay,
    inQuietHours,
    minutesUntilEnd,
    bypasses,
  };
})();
