export enum ExecutionMode {
  LEGACY = 'LEGACY', // Standard Solana (Probabilistic)
  RAIKU = 'RAIKU'    // Raiku (Deterministic)
}

export enum TxStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DROPPED = 'DROPPED',
  REORDERED = 'REORDERED'
}

export enum Scenario {
  NORMAL = 'NORMAL',
  NFT_MINT = 'NFT_MINT',     // High spam, high drop rate on Legacy
  MARKET_CRASH = 'MARKET_CRASH' // High MEV, high priority fees
}

export interface Transaction {
  id: string;
  timestamp: number;
  priorityFee: number;
  type: 'SWAP' | 'LIQUIDATION' | 'MINT' | 'TRANSFER';
  status: TxStatus;
  slotTarget: number;
  executionTime?: number;
}

export interface SimulationStats {
  totalTx: number;
  droppedTx: number;
  avgLatency: number;
  jitter: number;
  mevLost: number;
  slotsUtilized: number;
}

export interface Block {
  slot: number;
  transactions: Transaction[];
  isFinalized: boolean;
}