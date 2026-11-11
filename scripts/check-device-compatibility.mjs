import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, globals) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, ...globals });
  return exports;
}

// Accessing the storage property itself can throw in restricted browsers.
const blocked = { get localStorage() { throw new Error('SecurityError'); } };
const preferences = load('../src/lib/browserStorage.ts', { window: blocked });
assert.equal(preferences.readStoredPreference('ageVerified'), null);
assert.doesNotThrow(() => preferences.writeStoredPreference('ageVerified', 'true'));
const values = new Map();
const working = load('../src/lib/browserStorage.ts', {
  window: { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } },
});
working.writeStoredPreference('ageVerified', 'true');
assert.equal(working.readStoredPreference('ageVerified'), 'true');

for (const legacy of [false, true]) {
  let listener;
  let cleanup;
  let state;
  let removed = false;
  const media = { matches: true };
  const add = callback => { listener = callback; };
  const remove = callback => { assert.equal(callback, listener); removed = true; };
  if (legacy) {
    media.addListener = add;
    media.removeListener = remove;
  } else {
    media.addEventListener = (event, callback) => { assert.equal(event, 'change'); add(callback); };
    media.removeEventListener = (event, callback) => { assert.equal(event, 'change'); remove(callback); };
  }
  const hooks = load('../src/hooks/useMediaQuery.tsx', {
    window: { matchMedia: () => media },
    require: () => ({
      useState: init => { state = init(); return [state, value => { state = value; }]; },
      useEffect: effect => { cleanup = effect(); },
    }),
  });
  assert.equal(hooks.useMediaQuery('(max-width: 768px)'), true);
  listener({ matches: false });
  assert.equal(state, false);
  cleanup();
  assert.equal(removed, true);
}
console.log('Device compatibility checks passed: blocked storage, saved preferences, modern and legacy media listeners.');

// Execute the real startup recovery listeners without mounting React or the SW.
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const recovery = main.slice(main.indexOf('const CHUNK_RELOAD_KEY'), main.indexOf('// Clear the guard'));
const listeners = new Map();
const session = new Map();
let reloads = 0;
vm.runInNewContext(ts.transpileModule(recovery, {}).outputText, {
  window: {
    addEventListener: (event, callback) => listeners.set(event, callback),
    location: { reload: () => { reloads++; } },
  },
  sessionStorage: {
    getItem: key => session.get(key),
    setItem: (key, value) => session.set(key, value),
  },
});
const preload = listeners.get('vite:preloadError');
preload({ payload: new Error('An unrelated error') });
assert.equal(reloads, 0);
preload({ payload: new Error('Failed to fetch dynamically imported module') });
assert.equal(reloads, 1);
preload({ payload: new Error('Failed to fetch dynamically imported module') });
assert.equal(reloads, 1);
console.log('Cached deployment recovery passed: Vite import failure reloads once, unrelated errors do not.');
