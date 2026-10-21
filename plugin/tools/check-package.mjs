/**
 * Confere o que será publicado nos dois pacotes do plugin, sem depender de npm.
 * Pega as falhas clássicas de publicação: `files` apontando para arquivo
 * inexistente, `main` ausente, patch declarado mas não versionado e versão do
 * cliente diferente da declarada pelo bundle.
 *
 *   node plugin/tools/check-package.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}

function ok(message) {
  notes.push(message);
}

function readPackage(dir, label) {
  const file = join(dir, 'package.json');
  if (!existsSync(file)) {
    fail(`${label}: package.json ausente em ${dir}`);
    return null;
  }
  try {
    return { json: JSON.parse(readFileSync(file, 'utf8')), dir };
  } catch (error) {
    fail(`${label}: package.json inválido (${error.message})`);
    return null;
  }
}

function requireFields(pkg, label, fields) {
  for (const field of fields) {
    if (!pkg[field]) fail(`${label}: campo obrigatório ausente: ${field}`);
  }
}

function checkPublishList(pkg, label, dir) {
  if (!Array.isArray(pkg.files) || pkg.files.length === 0) {
    fail(`${label}: "files" vazio — o pacote publicaria o diretório inteiro`);
    return;
  }
  for (const entry of pkg.files) {
    const target = join(dir, entry);
    if (!existsSync(target)) {
      fail(`${label}: "files" lista ${entry}, que não existe`);
      continue;
    }
    ok(`${label}: ${entry} presente`);
  }
  if (!pkg.files.includes(pkg.main)) {
    fail(`${label}: "main" (${pkg.main}) não está em "files" — o pacote quebraria ao instalar`);
  }
}

/* ------------------------------------------------------------------ */
/* Bundle                                                              */
/* ------------------------------------------------------------------ */

const bundle = readPackage(root, 'bundle');
if (bundle) {
  const { json, dir } = bundle;
  requireFields(json, 'bundle', ['name', 'version', 'description', 'license', 'main']);
  checkPublishList(json, 'bundle', dir);

  const patch = json.dsh?.bundle?.patch;
  if (!patch) {
    fail('bundle: dsh.bundle.patch não declarado — o dsh plugin add não veria uma camada de patch');
  } else {
    const patchPath = join(dir, patch);
    if (!existsSync(patchPath)) {
      fail(`bundle: patch declarado em ${patch}, mas o arquivo não existe`);
    } else if (!json.files.includes(patch.replace(/^\.\//, ''))) {
      fail(`bundle: patch ${patch} existe mas não está em "files" — ficaria fora do pacote`);
    } else {
      ok(`bundle: patch ${patch} versionado`);
    }
  }

  const clientPkg = readPackage(join(root, 'client'), 'client');
  if (clientPkg) {
    const dependency = json.dependencies?.[clientPkg.json.name];
    if (!dependency) {
      fail(`bundle: não declara ${clientPkg.json.name} em dependencies — a linha do patch não resolveria`);
    } else if (dependency !== clientPkg.json.version) {
      fail(
        `bundle: depende de ${clientPkg.json.name}@${dependency}, mas o pacote está em ${clientPkg.json.version}`,
      );
    } else {
      ok(`bundle: depende de ${clientPkg.json.name}@${dependency} (versões alinhadas)`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Cliente                                                             */
/* ------------------------------------------------------------------ */

const client = readPackage(join(root, 'client'), 'client');
if (client) {
  const { json, dir } = client;
  requireFields(json, 'client', ['name', 'version', 'description', 'license', 'main']);
  checkPublishList(json, 'client', dir);

  const dshClient = json.dsh?.client;
  if (!dshClient) {
    fail('client: dsh.client não declarado — o navegador não carregaria a metade visual');
  } else {
    if (dshClient.platform !== 'web') {
      fail(`client: dsh.client.platform deveria ser "web", veio "${dshClient.platform}"`);
    }
    if (!Array.isArray(dshClient.inject) || !dshClient.inject.includes('@deepseek-ai/dsh-client-ui-session')) {
      fail('client: dsh.client.inject precisa incluir @deepseek-ai/dsh-client-ui-session');
    }
    if (!json.files.includes('lib/client.js')) {
      fail('client: lib/client.js fora de "files" — o navegador não teria o plugin');
    }
    // O carregador resolve a metade browser por `<pacote>/client`; sem esse
    // mapa de exports o módulo não é servido e o plugin falha em silêncio.
    const clientEntry = json.exports?.['./client'];
    if (clientEntry === undefined) {
      fail('client: exports["./client"] ausente — o DSH não encontraria lib/client.js');
    } else if (!existsSync(join(dir, String(clientEntry)))) {
      fail(`client: exports["./client"] aponta para ${clientEntry}, que não existe`);
    } else {
      ok('client: exports["./client"] declarado');
    }
    ok('client: dsh.client declarado para a web');
  }

  const bundleEntry = join(dir, 'lib/client.js');
  if (existsSync(bundleEntry)) {
    const source = readFileSync(bundleEntry, 'utf8');
    if (!source.includes('__ModuleLoader__.load(')) {
      fail('client: lib/client.js não usa window.__ModuleLoader__.load — o carregador do DSH não o encontraria');
    } else {
      ok('client: lib/client.js no formato do carregador');
    }
  }
}

/* ------------------------------------------------------------------ */

for (const note of notes) console.log(`ok  ${note}`);
for (const problem of problems) console.log(`FALHOU ${problem}`);

console.log(`\n${problems.length === 0 ? 'pacotes consistentes' : `${problems.length} problema(s) encontrado(s)`}`);
if (problems.length > 0) process.exitCode = 1;
