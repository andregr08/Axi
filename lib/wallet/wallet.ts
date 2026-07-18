import {
  getDriverWallet,
  getWalletTransactions,
} from "./walletQueries";

export async function loadWallet() {
  const [wallet, transactions] =
    await Promise.all([
      getDriverWallet(),
      getWalletTransactions(),
    ]);

  return {
    wallet,
    transactions,
  };
}
