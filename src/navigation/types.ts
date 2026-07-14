export type RootStackParamList = {
  Home: undefined;
  Pockets: undefined;
  PocketDetail: { pocketId: string };
  TransactionEditor: {
    transactionId?: string;
    presetKind?: 'income' | 'expense' | 'transfer';
    pocketId?: string;
    fromPocketId?: string;
    toPocketId?: string;
  };
  History: { pocketId?: string } | undefined;
  Statistics: { initialCurrency?: string } | undefined;
  Settings: undefined;
  AssetTypes: undefined;
  Categories: undefined;
  Jar: undefined;
  JarSplit: undefined;
  JarAdvanced: undefined;
  JarAdvancedAssetEditor: { currency: string };
};
