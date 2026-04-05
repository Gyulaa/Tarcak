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
  Settings: undefined;
  AssetTypes: undefined;
  Jar: undefined;
  JarSplit: undefined;
};
