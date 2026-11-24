// server/services/unifiedSettlementService.ts
import { Pool } from 'pg';

export interface ChainSettlementAdapters {
  hotWalletDispatch(params: {
    to: string;
    amount: string;
    rail: 'HOT_WALLET' | 'SOLANA' | 'SMART_CHAIN';
    referenceId: string;
  }): Promise<{ txHash: string; gasFee: string }>;

  settleSolanaContract(params: {
    userSolanaAddress: string;
    hotWalletSolanaAddress: string;
    programId: string;
    amount: string;
    settlementId: string;
  }): Promise<{ signature: string; feeSol: string }>;

  settleSmartChainContract(params: {
    userEvmAddress: string;
    hotWalletEvmAddress: string;
    contractAddress: string;
    chainId: number;
    amount: string;
    settlementId: string;
  }): Promise<{ txHash: string; gasWei: string }>;
}

export class UnifiedSettlementService {
  private readonly db: Pool;
  private readonly adapters: ChainSettlementAdapters;
  private readonly config: {
    hotWalletAddress: string;
    solanaProgramId: string;
    hotWalletSolanaAddress: string;
    smartChainContractAddress: string;
    smartChainId: number;
    hotWalletEvmAddress: string;
  };

  constructor(
    db: Pool,
    adapters: ChainSettlementAdapters,
    config: {
      hotWalletAddress: string;
      solanaProgramId: string;
      hotWalletSolanaAddress: string;
      smartChainContractAddress: string;
      smartChainId: number;
      hotWalletEvmAddress: string;
    }
  ) {
    this.db = db;
    this.adapters = adapters;
    this.config = config;
  }

  public async executeAlignedSettlement(params: {
    settlementId: string;
    userId: string;
    amount: number;
    destinationAddress: string;
    rail: 'HOT_WALLET' | 'SOLANA' | 'SMART_CHAIN';
    actionType: 'WIN_SETTLEMENT' | 'WITHDRAWAL';
  }): Promise<{ settlementId: string; txRef: string; status: string }> {
    const { settlementId, userId, amount, destinationAddress, rail, actionType } = params;

    let txRef = '';
    let feePaid = '0';

    if (rail === 'SOLANA') {
      const solRes = await this.adapters.settleSolanaContract({
        userSolanaAddress: destinationAddress,
        hotWalletSolanaAddress: this.config.hotWalletSolanaAddress,
        programId: this.config.solanaProgramId,
        amount: amount.toString(),
        settlementId,
      });
      txRef = solRes.signature;
      feePaid = solRes.feeSol;
    } else if (rail === 'SMART_CHAIN') {
      const evmRes = await this.adapters.settleSmartChainContract({
        userEvmAddress: destinationAddress,
        hotWalletEvmAddress: this.config.hotWalletEvmAddress,
        contractAddress: this.config.smartChainContractAddress,
        chainId: this.config.smartChainId,
        amount: amount.toString(),
        settlementId,
      });
      txRef = evmRes.txHash;
      feePaid = evmRes.gasWei;
    } else {
      const hwRes = await this.adapters.hotWalletDispatch({
        to: destinationAddress,
        amount: amount.toString(),
        rail: 'HOT_WALLET',
        referenceId: settlementId,
      });
      txRef = hwRes.txHash;
      feePaid = hwRes.gasFee;
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO financial_ledger
           (user_id, entry_type, amount, hot_wallet_address, gas_fee_paid, tx_hash, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', $7::jsonb)`,
        [
          userId,
          actionType,
          amount,
          this.config.hotWalletAddress,
          Number(feePaid) || 0,
          txRef,
          JSON.stringify({
            settlementId,
            rail,
            destinationAddress,
            solanaProgramId: this.config.solanaProgramId,
            smartChainContractAddress: this.config.smartChainContractAddress,
            smartChainId: this.config.smartChainId,
          }),
        ]
      );

      if (actionType === 'WITHDRAWAL') {
        await client.query(
          `UPDATE user_balances
           SET available_balance = GREATEST(available_balance - $2, 0), updated_at = NOW()
           WHERE user_id = $1`,
          [userId, amount]
        );
      }

      await client.query('COMMIT');
      return { settlementId, txRef, status: 'CONFIRMED' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

// Default in-memory simulation adapters for testing and standalone edge invocation
export const createDefaultAdapters = (): ChainSettlementAdapters => ({
  async hotWalletDispatch({ to, amount, rail, referenceId }) {
    const txHash = `0xhw_${Date.now().toString(16)}_${Math.random().toString(16).substring(2, 8)}`;
    return { txHash, gasFee: '0.00021' };
  },
  async settleSolanaContract({ userSolanaAddress, programId, amount, settlementId }) {
    const signature = `sol_sig_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    return { signature, feeSol: '0.000005' };
  },
  async settleSmartChainContract({ userEvmAddress, contractAddress, chainId, amount, settlementId }) {
    const txHash = `0xevm_${Date.now().toString(16)}_${Math.random().toString(16).substring(2, 10)}`;
    return { txHash, gasWei: '21000' };
  }
});
