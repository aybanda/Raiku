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
  BarChart3
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
  const [currentSlot, setCurrentSlot] = useState(1000);
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
    let count = Math.floor(Math.random() * 5) + 2; 
    let baseFee = 1000;
    
    // Scenario Adjustments
    if (currentScenario === Scenario.NFT_MINT) {
      count = Math.floor(Math.random() * 15) + 10; // Massive spike
    } else if (currentScenario === Scenario.MARKET_CRASH) {
      count = Math.floor(Math.random() * 8) + 5;
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
      
      let dropChance = 0.25;
      let reorderChance = 0.45;

      if (currentScenario === Scenario.NFT_MINT) {
        dropChance = 0.85; // Most txs fail during mints on legacy
      } else if (currentScenario === Scenario.MARKET_CRASH) {
        reorderChance = 0.90; // MEV bots go crazy
        dropChance = 0.40;
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
      mevLost: prev.mevLost + processedLegacy.filter(t => t.status === TxStatus.REORDERED || t.status === TxStatus.DROPPED).length * (Math.random() * (scenario === Scenario.MARKET_CRASH ? 500 : 50)),
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
    setCurrentSlot(1000);
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
    const result = await analyzeSimulation(legacyStats, raikuStats);
    setAiAnalysis(result);
    setIsAnalyzing(false);
    setTimeout(() => {
       scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-raiku-500/30">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-raiku-500 rounded flex items-center justify-center text-slate-950 font-bold font-mono">
              F
            </div>
            <span className="font-bold text-lg tracking-tight">Flux <span className="text-slate-500 font-normal">| Raiku Simulator</span></span>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1 rounded border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                LIVE SIMULATION
             </div>
             <a href="https://raiku.com" target="_blank" rel="noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">Documentation</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Intro Section */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            Deterministic Execution <span className="text-raiku-500">Solved</span>.
          </h1>
          <p className="text-lg text-slate-400">
            Compare Solana's current probabilistic execution against Raiku's Ahead-of-Time (AOT) slot reservations. See how deterministic ordering eliminates jitter and guarantees inclusion.
          </p>
        </section>

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 bg-slate-900/50 p-6 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-sm font-mono text-slate-400 uppercase tracking-widest mb-2">
            Simulation Scenario
          </div>
          
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <button 
              onClick={() => setScenario(Scenario.NORMAL)}
              className={`px-4 py-2 rounded border text-sm flex items-center gap-2 transition-all ${scenario === Scenario.NORMAL ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}
            >
              <Activity size={16} /> Normal Traffic
            </button>
            <button 
              onClick={() => setScenario(Scenario.NFT_MINT)}
              className={`px-4 py-2 rounded border text-sm flex items-center gap-2 transition-all ${scenario === Scenario.NFT_MINT ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}
            >
              <Flame size={16} /> NFT Mint (High Load)
            </button>
            <button 
              onClick={() => setScenario(Scenario.MARKET_CRASH)}
              className={`px-4 py-2 rounded border text-sm flex items-center gap-2 transition-all ${scenario === Scenario.MARKET_CRASH ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}
            >
              <BarChart3 size={16} /> Market Crash (High MEV)
            </button>
          </div>

          <div className="flex justify-center gap-4 w-full">
            <button 
              onClick={() => setIsRunning(!isRunning)}
              className={`
                flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all w-48
                ${isRunning 
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                  : 'bg-raiku-500 text-slate-950 hover:bg-raiku-400 hover:scale-105 shadow-[0_0_20px_rgba(0,255,163,0.3)]'}
              `}
            >
              {isRunning ? <Pause size={20} /> : <Play size={20} />}
              {isRunning ? 'PAUSE FLUX' : 'START SIMULATION'}
            </button>
            <button 
              onClick={handleReset}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-600 hover:text-white transition-all"
            >
              <RefreshCw size={20} />
              RESET
            </button>
          </div>
        </div>

        {/* Visualizers (Split Screen) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Legacy Column */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="flex items-center gap-2 font-mono text-solana-500 uppercase tracking-widest text-sm font-bold">
                <AlertTriangle size={16} /> Legacy Solana
              </h3>
              {scenario !== Scenario.NORMAL && (
                <span className="text-[10px] font-bold bg-red-900/50 text-red-400 px-2 py-0.5 rounded border border-red-800 animate-pulse">
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
                label="MEV Leakage" 
                value={`$${Math.floor(legacyStats.mevLost).toLocaleString()}`} 
                icon={<TrendingUp size={16} />}
                color="solana"
              />
            </div>
          </div>

          {/* Raiku Column */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="flex items-center gap-2 font-mono text-raiku-500 uppercase tracking-widest text-sm font-bold">
                <ShieldCheck size={16} /> Raiku AOT
              </h3>
              {scenario !== Scenario.NORMAL && (
                <span className="text-[10px] font-bold bg-raiku-900/50 text-raiku-400 px-2 py-0.5 rounded border border-raiku-800">
                  PROTECTED
                </span>
              )}
            </div>
            <SimulationVisualizer mode={ExecutionMode.RAIKU} transactions={raikuTxs} currentSlot={currentSlot} />
             <div className="grid grid-cols-2 gap-3">
              <StatsCard 
                label="Drop Rate" 
                value="0.0%" 
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
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity className="text-raiku-500" /> 
              Throughput & Consistency
            </h3>
            <span className="text-xs font-mono text-slate-500">TPS / SLOT</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="slot" stroke="#64748b" fontSize={12} tickFormatter={(val) => val.toString().slice(-3)} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#f8fafc' }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'monospace' }}
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
        <div className="space-y-6 pt-8 border-t border-slate-800" ref={scrollRef}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
             <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                  <BrainCircuit className="text-blue-400" />
                  Ackermann Node Analysis
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Powered by <span className="text-blue-300 font-semibold">Gemini 3 Pro</span>. Generates economic insights based on live simulation telemetry.
                </p>
             </div>
             <button
              onClick={handleAIAnalyze}
              disabled={isAnalyzing || legacyStats.totalTx < 10}
              className={`
                px-6 py-2 rounded font-mono text-sm border flex items-center gap-2
                ${isAnalyzing 
                  ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
                  : 'bg-blue-500/10 border-blue-500/50 text-blue-400 hover:bg-blue-500/20'}
              `}
             >
               {isAnalyzing ? (
                 <>
                   <RefreshCw className="animate-spin" size={14} /> ANALYZING TELEMETRY...
                 </>
               ) : (
                 <>
                   <Cpu size={14} /> GENERATE REPORT
                 </>
               )}
             </button>
          </div>

          {aiAnalysis ? (
            <div className="bg-slate-900 border border-blue-900/30 rounded-xl p-6 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
               <div className="prose prose-invert max-w-none font-sans text-slate-300 leading-relaxed whitespace-pre-line">
                 {aiAnalysis}
               </div>
               <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 font-mono">
                  <span>MODEL: gemini-3-pro-preview</span>
                  <span>STATUS: OPTIMIZED</span>
               </div>
            </div>
          ) : (
            <div className="h-32 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-600">
               <span className="text-sm">Run simulation for at least 5 seconds to generate data points.</span>
               <span className="text-xs mt-2 font-mono">WAITING FOR INPUT STREAM...</span>
            </div>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 mt-12 py-8 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-600 text-sm">
            Built for Solana Hacker Hotel DevCon 2025. 
            <span className="block mt-1 text-xs text-slate-700">Flux Simulator is a conceptual prototype.</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

// Icons needed for components
import { CheckCircle2, XCircle } from 'lucide-react';