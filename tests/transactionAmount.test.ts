import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { LedgerTransaction } from '../src/domain/types';
import { transactionAmountText } from '../src/utils/transactionAmount';

function tx(over: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    id: 't',
    kind: 'income',
    title: 'x',
    amount_minor: 3_100 * 1e8,
    currency: 'HUF',
    occurred_at: 0,
    created_at: 0,
    updated_at: 0,
    pocket_id: null,
    from_pocket_id: null,
    to_pocket_id: null,
    category_id: null,
    ...over,
  };
}

describe('transactionAmountText', () => {
  test('income is plus, expense is minus', () => {
    assert.equal(transactionAmountText(tx({ kind: 'income' })), '+3 100 HUF');
    assert.equal(transactionAmountText(tx({ kind: 'expense' })), '-3 100 HUF');
  });

  test('a transfer has no sign outside a pocket', () => {
    assert.equal(transactionAmountText(tx({ kind: 'transfer', from_pocket_id: 'a', to_pocket_id: 'b' })), '3 100 HUF');
  });

  test('a transfer is plus into the pocket and minus out of it', () => {
    const t = tx({ kind: 'transfer', from_pocket_id: 'a', to_pocket_id: 'b' });
    assert.equal(transactionAmountText(t, 'b'), '+3 100 HUF');
    assert.equal(transactionAmountText(t, 'a'), '-3 100 HUF');
    assert.equal(transactionAmountText(t, 'c'), '3 100 HUF');
  });
});
