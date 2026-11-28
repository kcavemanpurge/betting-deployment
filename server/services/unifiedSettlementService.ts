// server/services/unifiedSettlementService.ts
import { Pool } from 'pg';

export type SettlementRail = 'HOT_WALLET' | 'SOLANA' | 'SMART_CHAIN';
export type SettlementActionType = 'WIN_SETTLEMENT' | 'WITHDRAWAL';

export interface ChainSettlementAdapters {
  hotWalletDispatch(params: {
    to: string;
    amount: string;
    rail: SettlementRail;
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

export interface SettlementConfig {
  hotWalletAddress: string;
  solanaProgramId: string;
  hotWalletSolanaAddress: string;
  smartChainContractAddress: string;
  smartChainId: number;
  hotWalletEvmAddress: string;
}

export class UnifiedSettlementService {
  private readonly db: Pool;
  private readonly adapters: ChainSettlementAdapters;
  private readonly config: SettlementConfig;

  constructor(db: Pool, adapters: ChainSettlementAdapters, config: SettlementConfig) {
    this.db = db;
    this.adapters = adapters;
    this.config = config;
  }

  private resolveHotWallet(rail: SettlementRail): string {
    if (rail === 'SOLANA') return this.config.hotWalletSolanaAddress;
    if (rail === 'SMART_CHAIN') return this.config.hotWalletEvmAddress;
    return this.config.hotWalletAddress;
  }

  public async executeAlignedSettlement(params: {
    settlementId: string;
    userId: string;
    amount: number;
    destinationAddress: string;
    rail: SettlementRail;
    actionType: SettlementActionType;
  }): Promise<{ settlementId: string; txRef: string; status: string }> {
    const { settlementId, userId, amount, destinationAddress, rail, actionType } = params;

    if (!settlementId.trim() || !userId.trim() || !destinationAddress.trim()) {
      throw new Error('SETTLEMENT_INVALID_PARAMS');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('SETTLEMENT_INVALID_AMOUNT');
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 1. Reject duplicate settlementId attempts (anti-replay / anti-arbitrage)
      const existing = await client.query(
        `SELECT id, tx_hash, status
         FROM financial_ledger
         WHERE metadata->>'settlementId' = $1
         LIMIT 1`,
        [settlementId]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new Error(`DUPLICATE_SETTLEMENT_ID:${settlementId}`);
      }

      // 2. Lock and verify balance for withdrawals before any external chain dispatch
      if (actionType === 'WITHDRAWAL') {
        const balRes = await client.query(
          `SELECT available_balance::numeric AS available_balance
           FROM user_balances
           WHERE user_id = $1
           FOR UPDATE`,
          [userId]
        );
        if (balRes.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new Error('USER_BALANCE_NOT_FOUND');
        }
        const currentBalance = Number(balRes.rows[0].available_balance);
        if (currentBalance < amount) {
          await client.query('ROLLBACK');
          throw new Error('INSUFFICIENT_BALANCE');
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback error if transaction already aborted
      }
      throw err;
    } finally {
      client.release();
    }

    // 3. Execute adapter settlement once pre-checks & balance lock validation passed
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
        rail,
        referenceId: settlementId,
      });
      txRef = hwRes.txHash;
      feePaid = hwRes.gasFee;
    }

    // 4. Commit ledger entry and debit balance atomically
    const ledgerClient = await this.db.connect();
    try {
      await ledgerClient.query('BEGIN');

      if (actionType === 'WITHDRAWAL') {
        const updated = await ledgerClient.query(
          `UPDATE user_balances
           SET available_balance = available_balance - $2,
               updated_at = NOW()
           WHERE user_id = $1
             AND available_balance >= $2
           RETURNING available_balance`,
          [userId, amount]
        );
        if (updated.rowCount === 0) {
          await ledgerClient.query('ROLLBACK');
          throw new Error('INSUFFICIENT_BALANCE_ON_COMMIT');
        }
      }

      await ledgerClient.query(
        `INSERT INTO financial_ledger
           (user_id, entry_type, amount, hot_wallet_address, gas_fee_paid, tx_hash, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', $7::jsonb)`,
        [
          userId,
          actionType,
          amount,
          this.resolveHotWallet(rail),
          Number(feePaid) || 0,
          txRef,
          JSON.stringify({
            settlementId,
            rail,
            rawFee: feePaid,
            destinationAddress,
            solanaProgramId: this.config.solanaProgramId,
            smartChainContractAddress: this.config.smartChainContractAddress,
            smartChainId: this.config.smartChainId,
          }),
        ]
      );

      await ledgerClient.query('COMMIT');
      return { settlementId, txRef, status: 'CONFIRMED' };
    } catch (err) {
      await ledgerClient.query('ROLLBACK');
      throw err;
    } finally {
      ledgerClient.release();
    }
  }
}

// Default simulation adapters for local testing / staging environments only
export const createDefaultAdapters = (): ChainSettlementAdapters => ({
  async hotWalletDispatch({ referenceId }) {
    const txHash = `0xhw_${Date.now().toString(16)}_${Math.random().toString(16).substring(2, 8)}_${referenceId.slice(-6)}`;
    return { txHash, gasFee: '0.00021' };
  },
  async settleSolanaContract({ settlementId }) {
    const signature = `sol_sig_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${settlementId.slice(-6)}`;
    return { signature, feeSol: '0.000005' };
  },
  async settleSmartChainContract({ settlementId }) {
    const txHash = `0xevm_${Date.now().toString(16)}_${Math.random().toString(16).substring(2, 10)}_${settlementId.slice(-6)}`;
    return { txHash, gasWei: '21000' };
  },
});