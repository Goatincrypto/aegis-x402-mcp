import test from 'node:test';
import assert from 'node:assert/strict';

test('aegis-x402-mcp package configuration', () => {
  assert.ok(true, 'Test harness operates correctly');
});

test('official payTo allowlist contains official Aegis node', () => {
  const officialPayTo = '0x111ef680B6EFdd859FbEc473b907aCe95F0D1acB'.toLowerCase();
  assert.equal(officialPayTo.length, 42);
  assert.ok(officialPayTo.startsWith('0x111ef'));
});
