import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

const mobileRequire = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const routerRequire = createRequire(mobileRequire.resolve('expo-router/package.json'));
const queryStringPath = routerRequire.resolve('query-string');

test('Expo query-string retains CommonJS decoding with the fixed decoder', () => {
  const queryString = routerRequire('query-string');
  assert.equal(queryString.parse('name=hello+world&currency=%E2%82%AC').name, 'hello world');
  assert.equal(queryString.parse('currency=%E2%82%AC').currency, '€');
  assert.equal(queryString.parse('broken=%FF%41').broken, '%FFA');
  assert.equal(queryString.parse('broken=%').broken, '%');
  assert.equal(queryString.parse('literal=%FF%24%26').literal, '%FF$&');
});

test('malformed percent runs finish within a bounded child process', () => {
  // Isolate the adversarial input so a recursive decoder regression cannot hang CI.
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const queryString = require(process.argv[1]);
    const malformed = '%FF'.repeat(20000) + '%41';
    assert.equal(queryString.parse('value=' + malformed).value, '%FF'.repeat(20000) + 'A');
  `, queryStringPath], { timeout: 5000, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr?.slice(0, 1000));
});

test('Expo xcode UUID generation remains callable and produces project identifiers', () => {
  const expoRequire = createRequire(mobileRequire.resolve('expo/package.json'));
  const configRequire = createRequire(expoRequire.resolve('@expo/config-plugins/package.json'));
  const xcode = configRequire('xcode');
  const project = xcode.project('/unused/test.pbxproj');
  project.hash = { project: { objects: {} } };
  const identifiers = new Set(Array.from({ length: 100 }, () => project.generateUuid()));
  assert.equal(identifiers.size, 100);
  for (const identifier of identifiers) assert.match(identifier, /^[A-F0-9]{24}$/);
});
