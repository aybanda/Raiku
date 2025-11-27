import React from 'react';
import { Transaction, TxStatus, ExecutionMode } from '../types';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface VisualizerProps {
  mode: ExecutionMode;
  transactions: Transaction[];
  currentSlot: number;
}

export const SimulationVisualizer: React.FC<VisualizerProps> = ({ mode, transactions, currentSlot }) => {
  // Filter recent txs for visualization
  const recentTxs = transactions.slice(-12).reverse();

  const isRaiku = mode === ExecutionMode.RAIKU;

  return (
    <div className="relative h-64 w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
      {/* Header */}
      <div className={`px-4 py-2 border-b flex justify-between items-center ${isRaiku ? 'border-raiku-900/50 bg-raiku-900/10' : 'border-solana-600/20 bg-solana-600/5'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRaiku ? 'bg-raiku-500 animate-pulse' : 'bg-solana-500'}`} />
          <span className={`font-mono text-sm font-bold ${isRaiku ? 'text-raiku-500' : 'text-solana-500'}`}>
            {isRaiku ? 'RAIKU AOT' : 'LEGACY RPC'}
          </span>
        </div>
        <span className="font-mono text-xs text-slate-500">Slot: {currentSlot}</span>
      </div>

      {/* Lane Visualization */}
      <div className="flex-1 relative p-4 flex gap-2 items-end justify-center overflow-hidden">
        {/* Background Grid Lines */}
        <div className="absolute inset-0 grid grid-cols-6 gap-2 opacity-10 pointer-events-none">
          {[...Array(6)].map((_, i) => (
             <div key={i} className="border-r border-slate-500 h-full" />
          ))}
        </div>

        {recentTxs.map((tx, idx) => {
          let colorClass = 'bg-slate-700';
          let borderColor = 'border-slate-600';
          let StatusIcon = AlertCircle;

          if (tx.status === TxStatus.CONFIRMED) {
            colorClass = isRaiku ? 'bg-raiku-600' : 'bg-solana-600';
            borderColor = isRaiku ? 'border-raiku-500' : 'border-solana-400';
            StatusIcon = CheckCircle2;
          } else if (tx.status === TxStatus.DROPPED) {
            colorClass = 'bg-red-900/50';
            borderColor = 'border-red-800';
            StatusIcon = XCircle;
          } else if (tx.status === TxStatus.REORDERED) {
             colorClass = 'bg-orange-900/50';
             borderColor = 'border-orange-800';
             StatusIcon = AlertCircle;
          }

          // Randomize vertical position for Legacy to show chaos
          const randomY = !isRaiku && tx.status !== TxStatus.CONFIRMED ? Math.random() * 20 : 0;
          
          return (
            <div
              key={tx.id}
              className={`
                relative w-12 h-16 rounded border ${colorClass} ${borderColor} 
                flex items-center justify-center transition-all duration-500
                shadow-lg
              `}
              style={{
                transform: `translateY(${randomY}px)`,
                opacity: 1 - (idx * 0.08) // Fade out older ones
              }}
            >
              <div className="text-[10px] font-mono text-white/90 flex flex-col items-center">
                <span>{tx.type.substring(0, 2)}</span>
                <StatusIcon size={12} className="mt-1" />
              </div>
              
              {/* Priority Fee Badge */}
              <div className="absolute -top-2 -right-2 bg-slate-900 text-[8px] px-1 rounded border border-slate-700 text-slate-400">
                {tx.priorityFee}μ
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer / Mempool Indicator */}
      <div className="h-8 bg-slate-900/50 border-t border-slate-800 flex items-center px-4 justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest">
          {isRaiku ? 'Deterministic Schedule' : 'Public Mempool (Chaos)'}
        </span>
        {!isRaiku && (
          <div className="flex gap-1">
             {[...Array(3)].map((_,i) => (
               <div key={i} className="w-1 h-1 bg-red-500 rounded-full animate-bounce" style={{animationDelay: `${i*100}ms`}}/>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};