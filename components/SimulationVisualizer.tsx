import React from 'react';
import { Transaction, TxStatus, ExecutionMode } from '../types';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from 'lucide-react';

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
      <div className={`px-4 py-2 border-b flex justify-between items-center z-20 ${isRaiku ? 'border-raiku-900/50 bg-raiku-900/10' : 'border-solana-600/20 bg-solana-600/5'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRaiku ? 'bg-raiku-500 animate-pulse' : 'bg-solana-500'}`} />
          <span className={`font-mono text-sm font-bold ${isRaiku ? 'text-raiku-500' : 'text-solana-500'}`}>
            {isRaiku ? 'RAIKU AOT RESERVATIONS' : 'LEGACY PUBLIC MEMPOOL'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-500">Slot: {currentSlot}</span>
          {isRaiku && <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />}
        </div>
      </div>

      {/* Lane Visualization */}
      <div className="flex-1 relative p-4 flex gap-2 items-end justify-center overflow-hidden">
        
        {/* Background Grid Lines / Animation */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
           {isRaiku ? (
             // Moving Grid for Raiku (Flow)
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ffa310_1px,transparent_1px),linear-gradient(to_bottom,#00ffa310_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] animate-[pulse_3s_ease-in-out_infinite]" />
           ) : (
             // Static/Chaotic Grid for Legacy
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
           )}
        </div>

        {recentTxs.map((tx, idx) => {
          let colorClass = 'bg-slate-700';
          let borderColor = 'border-slate-600';
          let StatusIcon = AlertCircle;
          let glowEffect = '';

          if (tx.status === TxStatus.CONFIRMED) {
            colorClass = isRaiku ? 'bg-raiku-600/20' : 'bg-solana-600/20';
            borderColor = isRaiku ? 'border-raiku-500' : 'border-solana-400';
            StatusIcon = CheckCircle2;
            glowEffect = isRaiku ? 'shadow-[0_0_15px_rgba(0,255,163,0.15)]' : '';
          } else if (tx.status === TxStatus.DROPPED) {
            colorClass = 'bg-red-900/10';
            borderColor = 'border-red-900';
            StatusIcon = XCircle;
          } else if (tx.status === TxStatus.REORDERED) {
             colorClass = 'bg-orange-900/10';
             borderColor = 'border-orange-800';
             StatusIcon = AlertCircle;
          }

          // Legacy: Chaotic randomness
          // Raiku: No vertical randomness, looking like a stable pipe
          const randomY = !isRaiku && tx.status !== TxStatus.CONFIRMED ? (Math.random() * 40 - 10) : 0;
          const randomX = !isRaiku && tx.status !== TxStatus.CONFIRMED ? (Math.random() * 20 - 10) : 0;
          const rotation = !isRaiku && tx.status !== TxStatus.CONFIRMED ? (Math.random() * 15 - 7) : 0;
          
          return (
            <div
              key={tx.id}
              className={`
                relative w-10 h-14 md:w-12 md:h-16 rounded border ${colorClass} ${borderColor} 
                flex items-center justify-center transition-all duration-500
                backdrop-blur-sm z-10 ${glowEffect}
              `}
              style={{
                transform: `translate(${randomX}px, ${randomY}px) rotate(${rotation}deg)`,
                opacity: 1 - (idx * 0.08), // Fade out older ones
                marginBottom: isRaiku ? '0px' : `${Math.random() * 10}px` // Add vertical scatter for legacy
              }}
            >
              <div className={`text-[10px] font-mono ${isRaiku ? 'text-raiku-400' : 'text-slate-300'} flex flex-col items-center`}>
                <span className="font-bold">{tx.type.substring(0, 2)}</span>
                <StatusIcon size={12} className={`mt-1 ${tx.status === TxStatus.DROPPED ? 'text-red-500' : ''}`} />
              </div>
              
              {/* Priority Fee Badge - Highlights MEV auction nature in Legacy */}
              {!isRaiku && tx.priorityFee > 1000 && (
                <div className="absolute -top-3 -right-2 bg-slate-900 text-[7px] px-1 rounded border border-slate-700 text-yellow-500 font-mono">
                  {tx.priorityFee}μ
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Footer / Mempool Indicator */}
      <div className="h-8 bg-slate-900/80 border-t border-slate-800 flex items-center px-4 justify-between z-20">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
          {isRaiku ? (
            <><ArrowRight size={10} className="text-raiku-500"/> DETERMINISTIC FIFO</>
          ) : (
            'UNORDERED MEMPOOL'
          )}
        </span>
        {!isRaiku && (
          <div className="flex gap-1">
             <div className="text-[9px] text-red-400 font-mono">CONGESTED</div>
             {[...Array(3)].map((_,i) => (
               <div key={i} className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{animationDelay: `${i * 100}ms`}}/>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};