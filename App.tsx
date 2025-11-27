import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Zap, 
  Activity, 
  ShieldCheck, 
  AlertTriangle,
  Cpu,
  TrendingUp,
  BrainCircuit,
  Flame,
  BarChart3,
  XCircle,
  CheckCircle2,
  Terminal
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

import { ExecutionMode, Transaction, TxStatus, SimulationStats, Scenario } from './types';
import { StatsCard } from './components/StatsCard';
import { SimulationVisualizer } from './components/SimulationVisualizer';
import { analyzeSimulation } from './services/geminiService';

// --- Constants ---
const MAX_HISTORY = 30;
const SLOT_TIME_MS = 400;

export default function App() {
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [currentSlot, setCurrentSlot] = useState(254000);
  const [scenario, setScenario] = useState<Scenario>(Scenario.NORMAL);
  
  // Data State
  const [legacyTxs, setLegacyTxs] = useState<Transaction[]>([]);
  const [raikuTxs, setRaikuTxs] = useState<Transaction[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Stats
  const [legacyStats, setLegacyStats] = useState<SimulationStats>({
    totalTx: 0, droppedTx: 0, avgLatency: 1200, jitter: 450, mevLost: 0, slotsUtilized: 85
  });
  const [raikuStats, setRaikuStats] = useState<SimulationStats>({
    totalTx: 0, droppedTx: 0, avgLatency: 400, jitter: 0, mevLost: 0, slotsUtilized: 98
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Simulation Logic ---

  const generateTransactions = (slot: number, currentScenario: Scenario): Transaction[] => {
    let count = Math.floor(Math.random() * 5) + 3; 
    let baseFee = 1000;
    
    // Scenario Adjustments
    if (currentScenario === Scenario.NFT_MINT) {
      count = Math.floor(Math.random() * 15) + 12; // Massive spike
    } else if (currentScenario === Scenario.MARKET_CRASH) {
      count = Math.floor(Math.random() * 8) + 6;
      baseFee = 50000; // High fees
    }

    const newTxs: Transaction[] = [];
    for (let i = 0; i < count; i++) {
      let type: any = 'SWAP';
      if (currentScenario === Scenario.NFT_MINT) type = 'MINT';
      else if (currentScenario === Scenario.MARKET_CRASH) type = 'LIQUIDATION';
      else type = Math.random() > 0.7 ? 'LIQUIDATION' : Math.random() > 0.5 ? 'SWAP' : 'MINT';

      newTxs.push({
        id: `${slot}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: Date.now(),
        priorityFee: Math.floor(Math.random() * baseFee),
        type,
        status: TxStatus.PENDING,
        slotTarget: slot + Math.floor(Math.random() * 2)
      });
    }
    return newTxs;
  };

  const processLegacyTransactions = (txs: Transaction[], currentScenario: Scenario): Transaction[] => {
    // Legacy: Simulate chaos based on scenario
    return txs.map(tx => {
      const rand = Math.random();
      
      let dropChance = 0.15;
      let reorderChance = 0.35;

      if (currentScenario === Scenario.NFT_MINT) {
        dropChance = 0.85; // Most txs fail during mints on legacy
      } else if (currentScenario === Scenario.MARKET_CRASH) {
        reorderChance = 0.95; // MEV bots go crazy
        dropChance = 0.45;
      }

      if (rand < dropChance) return { ...tx, status: TxStatus.DROPPED }; 
      if (rand < reorderChance) return { ...tx, status: TxStatus.REORDERED }; 
      return { ...tx, status: TxStatus.CONFIRMED };
    });
  };

  const processRaikuTransactions = (txs: Transaction[]): Transaction[] => {
    // Raiku: Deterministic - Always confirmed, perfectly ordered
    return txs.map(tx => ({ ...tx, status: TxStatus.CONFIRMED }));
  };

  const tick = useCallback(() => {
    setCurrentSlot(prev => prev + 1);
    const newRawTxs = generateTransactions(currentSlot, scenario);

    // 1. Process Legacy
    const processedLegacy = processLegacyTransactions(newRawTxs, scenario);
    setLegacyTxs(prev => [...prev.slice(-24), ...processedLegacy]); // Keep last 24 for visualizer
    
    // Update Legacy Stats
    setLegacyStats(prev => ({
      ...prev,
      totalTx: prev.totalTx + processedLegacy.length,
      droppedTx: prev.droppedTx + processedLegacy.filter(t => t.status === TxStatus.DROPPED).length,
      mevLost: prev.mevLost + processedLegacy.filter(t => t.status === TxStatus.REORDERED || t.status === TxStatus.DROPPED).length * (Math.random() * (scenario === Scenario.MARKET_CRASH ? 800 : 120)),
    }));

    // 2. Process Raiku
    const processedRaiku = processRaikuTransactions(newRawTxs);
    setRaikuTxs(prev => [...prev.slice(-24), ...processedRaiku]);

    // Update Raiku Stats
    setRaikuStats(prev => ({
      ...prev,
      totalTx: prev.totalTx + processedRaiku.length,
      droppedTx: prev.droppedTx, // Always 0
      mevLost: prev.mevLost, // Always 0
    }));

    // 3. Update Chart Data
    setPerformanceHistory(prev => {
      const newData = {
        slot: currentSlot,
        legacySuccess: processedLegacy.filter(t => t.status === TxStatus.CONFIRMED).length,
        raikuSuccess: processedRaiku.length, // All confirmed
      };
      const newHistory = [...prev, newData];
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return newHistory;
    });

  }, [currentSlot, scenario]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(tick, SLOT_TIME_MS);
    }
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  const handleReset = () => {
    setIsRunning(false);
    setCurrentSlot(254000);
    setScenario(Scenario.NORMAL);
    setLegacyTxs([]);
    setRaikuTxs([]);
    setPerformanceHistory([]);
    setLegacyStats({ totalTx: 0, droppedTx: 0, avgLatency: 1200, jitter: 450, mevLost: 0, slotsUtilized: 85 });
    setRaikuStats({ totalTx: 0, droppedTx: 0, avgLatency: 400, jitter: 0, mevLost: 0, slotsUtilized: 98 });
    setAiAnalysis(null);
  };

  const handleAIAnalyze = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(null);
    setTimeout(() => {
       scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    
    // Call Service
    const result = await analyzeSimulation(legacyStats, raikuStats, scenario);
    
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-raiku-500/30">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-[#020617]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-raiku-500 rounded flex items-center justify-center text-slate-950 font-bold font-mono shadow-[0_0_15px_rgba(0,255,163,0.3)]">
              F
            </div>
            <span className="font-bold text-lg tracking-tight">Flux <span className="text-slate-600 font-normal">| Raiku Simulator</span></span>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                <Terminal size={10} />
                <span>SDK v0.1.0-alpha</span>
             </div>
             <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                MAINNET-BETA
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Intro Section */}
        <section className="text-center max-w-3xl mx-auto space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-raiku-900/20 border border-raiku-900/50 text-raiku-400 text-xs font-mono mb-2">
            <Zap size={12} /> Challenge: Deterministic Execution
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            Certainty in a <span className="text-transparent bg-clip-text bg-gradient-to-r from-raiku-500 to-emerald-400">Probabilistic World</span>.
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            Simulate Raiku's <strong>Ahead-of-Time (AOT)</strong> slot reservations against Solana's standard execution. Witness how deterministic ordering eliminates jitter and guarantees inclusion for institutional DeFi.
          </p>
        </section>

        {/* Controls */}
        <div className="flex flex-col items-center gap-6 bg-slate-900/40 p-6 rounded-2xl border border-slate-800/60 shadow-xl backdrop-blur-sm">
          
          <div className="flex flex-col items-center gap-3">
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Select Network Conditions</span>
            <div className="flex flex-wrap justify-center gap-3">
              <button 
                onClick={() => setScenario(Scenario.NORMAL)}
                className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all duration-300 ${scenario === Scenario.NORMAL ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
              >
                <Activity size={16} /> Normal Traffic
              </button>
              <button 
                onClick={() => setScenario(Scenario.NFT_MINT)}
                className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all duration-300 ${scenario === Scenario.NFT_MINT ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
              >
                <Flame size={16} /> NFT Mint (Congestion)
              </button>
              <button 
                onClick={() => setScenario(Scenario.MARKET_CRASH)}
                className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all duration-300 ${scenario === Scenario.MARKET_CRASH ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
              >
                <BarChart3 size={16} /> Market Crash (MEV)
              </button>
            </div>
          </div>

          <div className="flex justify-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => setIsRunning(!isRunning)}
              className={`
                flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-bold transition-all w-full md:w-56 tracking-wide
                ${isRunning 
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' 
                  : 'bg-raiku-500 text-slate-950 hover:bg-raiku-400 hover:scale-105 hover:shadow-[0_0_25px_rgba(0,255,163,0.4)] border border-raiku-400'}
              `}
            >
              {isRunning ? <Pause size={18} /> : <Play size={18} />}
              {isRunning ? 'PAUSE FLUX' : 'START ENGINE'}
            </button>
            <button 
              onClick={handleReset}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-600 hover:text-white transition-all"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Visualizers (Split Screen) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Legacy Column */}
          <div className="space-y-4 group">
            <div className="flex justify-between items-center px-1">
              <h3 className="flex items-center gap-2 font-mono text-solana-500 uppercase tracking-widest text-sm font-bold group-hover:text-solana-600 transition-colors">
                <AlertTriangle size={16} /> Legacy Solana
              </h3>
              {scenario !== Scenario.NORMAL && (
                <span className="text-[10px] font-bold bg-red-900/20 text-red-400 px-2 py-0.5 rounded border border-red-900/50 animate-pulse">
                  HIGH CONGESTION
                </span>
              )}
            </div>
            <SimulationVisualizer mode={ExecutionMode.LEGACY} transactions={legacyTxs} currentSlot={currentSlot} />
            <div className="grid grid-cols-2 gap-3">
              <StatsCard 
                label="Drop Rate" 
                value={`${legacyStats.totalTx > 0 ? ((legacyStats.droppedTx / legacyStats.totalTx) * 100).toFixed(1) : 0}%`} 
                icon={<XCircle size={16} className="text-red-500"/>}
                color="red"
              />
              <StatsCard 
                label="Est. MEV Loss" 
                value={`$${Math.floor(legacyStats.mevLost).toLocaleString()}`} 
                icon={<TrendingUp size={16} />}
                color="solana"
              />
            </div>
          </div>

          {/* Raiku Column */}
          <div className="space-y-4 group">
            <div className="flex justify-between items-center px-1">
              <h3 className="flex items-center gap-2 font-mono text-raiku-500 uppercase tracking-widest text-sm font-bold group-hover:text-raiku-400 transition-colors">
                <ShieldCheck size={16} /> Raiku AOT
              </h3>
              <span className="text-[10px] font-bold bg-raiku-900/20 text-raiku-400 px-2 py-0.5 rounded border border-raiku-900/50">
                PROTECTED
              </span>
            </div>
            <SimulationVisualizer mode={ExecutionMode.RAIKU} transactions={raikuTxs} currentSlot={currentSlot} />
             <div className="grid grid-cols-2 gap-3">
              <StatsCard 
                label="Guaranteed" 
                value="100%" 
                icon={<CheckCircle2 size={16} className="text-raiku-500"/>}
                color="raiku"
              />
              <StatsCard 
                label="Slot Utilization" 
                value="100%" 
                icon={<Zap size={16} />}
                color="raiku"
              />
            </div>
          </div>

        </div>

        {/* Live Chart Section */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-20 text-slate-600">
            <Activity size={100} />
          </div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-200">
                Throughput Stability
              </h3>
              <p className="text-xs text-slate-500 mt-1">Comparing successful transactions included per slot</p>
            </div>
            <div className="flex gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#9945FF]"></div> Legacy
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#00FFA3]"></div> Raiku
              </div>
            </div>
          </div>
          <div className="h-64 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="slot" 
                  stroke="#475569" 
                  fontSize={10} 
                  tickFormatter={(val) => val.toString().slice(-3)} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#f8fafc', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'monospace' }}
                  cursor={{stroke: '#334155'}}
                />
                <Line 
                  type="monotone" 
                  dataKey="legacySuccess" 
                  name="Legacy Executed" 
                  stroke="#9945FF" 
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
                <Line 
                  type="stepAfter" 
                  dataKey="raikuSuccess" 
                  name="Raiku Guaranteed" 
                  stroke="#00FFA3" 
                  strokeWidth={2} 
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gemini AI Analysis Section */}
        <div className="space-y-6 pt-8 border-t border-slate-900" ref={scrollRef}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
             <div>
                <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                  <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                     <BrainCircuit className="text-blue-400" size={24} />
                  </div>
                  Ackermann Analysis Node
                </h2>
                <p className="text-slate-400 text-sm mt-2 max-w-xl">
                  Powered by <span className="text-blue-300 font-medium">Gemini 3 Pro</span>. This module analyzes real-time telemetry to calculate the economic impact of non-deterministic execution.
                </p>
             </div>
             <button
              onClick={handleAIAnalyze}
              disabled={isAnalyzing || legacyStats.totalTx < 10}
              className={`
                px-6 py-3 rounded-lg font-mono text-xs md:text-sm border flex items-center gap-3 transition-all
                ${isAnalyzing 
                  ? 'bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed w-full md:w-auto justify-center' 
                  : 'bg-blue-600/10 border-blue-500/40 text-blue-400 hover:bg-blue-600/20 hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] w-full md:w-auto justify-center'}
              `}
             >
               {isAnalyzing ? (
                 <>
                   <RefreshCw className="animate-spin" size={16} /> 
                   <span>PROCESSING TELEMETRY...</span>
                 </>
               ) : (
                 <>
                   <Cpu size={16} /> 
                   <span>RUN ACKERMANN DIAGNOSTIC</span>
                 </>
               )}
             </button>
          </div>

          {aiAnalysis ? (
            <div className="bg-[#0b1221] border border-blue-900/40 rounded-xl p-8 relative overflow-hidden shadow-2xl animate-in fade-in duration-700">
               {/* Decorative lines */}
               <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
               <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-blue-500 to-transparent opacity-20"></div>
               
               <div className="font-mono text-xs text-blue-500 mb-6 flex justify-between items-center border-b border-blue-900/30 pb-4">
                  <span>REPORT_ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                  <span>CONFIDENCE: 99.9%</span>
               </div>

               <div className="prose prose-invert prose-p:text-slate-300 prose-headings:text-blue-100 max-w-none font-sans leading-relaxed whitespace-pre-line">
                 {aiAnalysis}
               </div>
               
               <div className="mt-8 pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> LIVE UPLINK ESTABLISHED</span>
                  <span>GENERATED BY GEMINI-3-PRO-PREVIEW</span>
               </div>
            </div>
          ) : (
            <div className="h-48 rounded-xl border border-dashed border-slate-800 bg-slate-900/20 flex flex-col items-center justify-center text-slate-600 gap-4 transition-all">
               <Activity className="opacity-20" size={48} />
               <div className="text-center">
                 <p className="text-sm font-medium text-slate-500">Waiting for sufficient telemetry data...</p>
                 <p className="text-xs text-slate-700 mt-1 font-mono">Run simulation for >5s to enable AI diagnostics</p>
               </div>
            </div>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 mt-12 py-12 bg-[#020617]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-600 text-sm">
            Submitted for <span className="text-slate-400 font-medium">Solana Hacker Hotel DevCon 2025</span>
          </p>
          <p className="text-xs text-slate-700 mt-2">
             FLUX Concept Prototype • Powered by Raiku • Built with Gemini
          </p>
        </div>
      </footer>
    </div>
  );
}