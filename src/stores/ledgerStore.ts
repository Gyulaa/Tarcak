import { create } from 'zustand';

import type { BalanceRow, Pocket } from '../domain/types';
import * as pocketsRepo from '../db/repositories/pockets';
import * as txRepo from '../db/repositories/transactions';

type LedgerState = {
  pockets: Pocket[];
  homeBalances: BalanceRow[];
  loading: boolean;
  lastError: string | null;
  refresh: () => Promise<void>;
  addPocket: (name: string) => Promise<void>;
  renamePocket: (id: string, name: string) => Promise<void>;
  removePocketIfEmpty: (id: string) => Promise<boolean>;
};

export const useLedgerStore = create<LedgerState>((set, get) => ({
  pockets: [],
  homeBalances: [],
  loading: false,
  lastError: null,

  refresh: async () => {
    set({ loading: true, lastError: null });
    try {
      const pockets = await pocketsRepo.listPockets();
      const homeBalances = await txRepo.sumBalancesAll();
      set({ pockets, homeBalances, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ loading: false, lastError: msg });
    }
  },

  addPocket: async (name: string) => {
    await pocketsRepo.createPocket(name);
    await get().refresh();
  },

  renamePocket: async (id: string, name: string) => {
    await pocketsRepo.renamePocket(id, name);
    await get().refresh();
  },

  removePocketIfEmpty: async (id: string) => {
    const ok = await pocketsRepo.deletePocketIfUnused(id);
    if (ok) {
      await get().refresh();
    }
    return ok;
  },
}));
