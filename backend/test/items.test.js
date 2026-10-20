import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateItem } from '../src/items.js';

const item = {
  name: 'Proyektor Epson', code: 'BIN-ELE-001', category: 'Elektronik',
  location: 'Ruang 402', quantity: 8, status: 'available'
};

test('trims text and normalizes asset codes without changing quantity', () => {
  const result = validateItem({ ...item, name: '  Proyektor Epson  ', code: ' bin-ele-001 ', quantity: 0 });
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.item, { ...item, quantity: 0 });
});

for (const body of [null, undefined, [], 'barang', 1]) {
  test(`rejects a non-object body: ${JSON.stringify(body)}`, () => {
    assert.ok(validateItem(body).errors.body);
  });
}

const invalidFields = {
  name: ['', 'a', 'x'.repeat(101), 42],
  code: ['a', 'INVALID CODE', 'X'.repeat(31), 42],
  category: ['Other', null, {}],
  location: ['', 'a', 'x'.repeat(101), 42],
  quantity: [-1, 1.5, 100001, '8', null, true, NaN, Infinity],
  status: ['unknown', 'constructor', null]
};
for (const [field, values] of Object.entries(invalidFields)) {
  test(`rejects invalid ${field} values`, () => {
    for (const value of values) {
      assert.ok(validateItem({ ...item, [field]: value }).errors[field], String(value));
    }
  });
}

test('accepts every category and status at the quantity limits', () => {
  for (const category of ['Elektronik', 'Furnitur', 'Laboratorium', 'Perlengkapan']) {
    for (const status of ['available', 'borrowed', 'maintenance']) {
      for (const quantity of [0, 100000]) {
        assert.deepEqual(validateItem({ ...item, category, status, quantity }).errors, {});
      }
    }
  }
});
