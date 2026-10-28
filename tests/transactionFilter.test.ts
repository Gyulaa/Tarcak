import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildTransactionFilter, UNCATEGORIZED_FILTER } from '../src/domain/transactionFilter';

describe('buildTransactionFilter', () => {
  test('no filters give no clauses', () => {
    assert.deepEqual(buildTransactionFilter({}), { clauses: [], params: [] });
    assert.deepEqual(
      buildTransactionFilter({ kinds: [], currencies: [], pocketIds: [], categoryIds: [] }),
      { clauses: [], params: [] }
    );
  });

  test('a plain kind matches on the kind column', () => {
    const f = buildTransactionFilter({ kinds: ['expense', 'transfer'] });
    assert.deepEqual(f.clauses, ['(kind = ? OR kind = ?)']);
    assert.deepEqual(f.params, ['expense', 'transfer']);
  });

  test('income also matches transfers into the Jar from another pocket', () => {
    const f = buildTransactionFilter({ kinds: ['income'], jarPocketId: 'jar' });
    assert.deepEqual(f.clauses, [
      "(kind = ? OR (kind = 'transfer' AND to_pocket_id = ? AND from_pocket_id != ?))",
    ]);
    assert.deepEqual(f.params, ['income', 'jar', 'jar']);
  });

  test('income without a Jar is only the income kind', () => {
    const f = buildTransactionFilter({ kinds: ['income'], jarPocketId: null });
    assert.deepEqual(f.clauses, ['(kind = ?)']);
    assert.deepEqual(f.params, ['income']);
  });

  test('currencies match with IN', () => {
    const f = buildTransactionFilter({ currencies: ['HUF', 'EUR'] });
    assert.deepEqual(f.clauses, ['currency IN (?, ?)']);
    assert.deepEqual(f.params, ['HUF', 'EUR']);
  });

  test('a pocket matches as the pocket or either side of a transfer', () => {
    const f = buildTransactionFilter({ pocketIds: ['a', 'b'] });
    assert.deepEqual(f.clauses, [
      '(pocket_id = ? OR from_pocket_id = ? OR to_pocket_id = ? OR pocket_id = ? OR from_pocket_id = ? OR to_pocket_id = ?)',
    ]);
    assert.deepEqual(f.params, ['a', 'a', 'a', 'b', 'b', 'b']);
  });

  test('categories combine real ids and the uncategorized token', () => {
    const f = buildTransactionFilter({ categoryIds: ['c1', UNCATEGORIZED_FILTER] });
    assert.deepEqual(f.clauses, ['(category_id = ? OR category_id IS NULL)']);
    assert.deepEqual(f.params, ['c1']);
  });

  test('dimensions are ANDed, values inside one dimension ORed, params stay in clause order', () => {
    const f = buildTransactionFilter({
      kinds: ['expense'],
      currencies: ['HUF'],
      pocketIds: ['a'],
      categoryIds: [UNCATEGORIZED_FILTER],
    });
    assert.equal(f.clauses.length, 4);
    assert.deepEqual(f.params, ['expense', 'HUF', 'a', 'a', 'a']);
  });
});
