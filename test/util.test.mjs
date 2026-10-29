import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, parseArgs, validateAddress } from '../src/util.mjs';

test('normalizes domain', () => {
  assert.equal(normalizeDomain('EXAMPLE.COM.'), 'example.com');
});

test('validates Ethereum address shape', () => {
  const address = '0x101f99125E4Aa1402f0eaEF896cC175Ba1280f0A';
  assert.equal(validateAddress(address), address);
  assert.throws(() => validateAddress('0x1234'));
});

test('parses flags', () => {
  const args = parseArgs(['setup', '--domain', 'example.com', '--no-wait', '--json']);
  assert.deepEqual(args._, ['setup']);
  assert.equal(args.domain, 'example.com');
  assert.equal(args['no-wait'], true);
  assert.equal(args.json, true);
});
