import { GoogleGenAI } from "@google/genai";
import { SimulationStats, ExecutionMode, Scenario } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSimulation = async (
  legacyStats: SimulationStats,
  raikuStats: SimulationStats,
  scenario: Scenario
): Promise<string> => {
  
  // Calculate specific metrics for the prompt
  const legacyDropRate = legacyStats.totalTx > 0 ? ((legacyStats.droppedTx / legacyStats.totalTx) * 100).toFixed(1) : "0";
  const mevSaved = (legacyStats.mevLost - raikuStats.mevLost).toLocaleString();
  
  const prompt = `
    IDENTITY: You are the "Ackermann Economic Engine", a specialized AI module for the Raiku Protocol.
    
    CONTEXT:
    You are analyzing live telemetry from a comparative simulation between:
    1. LEGACY SOLANA: Probabilistic execution, subject to jitter, spam, and non-deterministic auctions.
    2. RAIKU: Deterministic execution using Ahead-of-Time (AOT) slot reservations and guaranteed ordering.

    CURRENT SIMULATION SCENARIO: ${scenario}
    
    TELEMETRY DATA:
    [Legacy Lane]
    - Drop Rate: ${legacyDropRate}%
    - MEV/Slippage Loss: $${legacyStats.mevLost.toLocaleString()}
    - Jitter: ${legacyStats.jitter}ms
    
    [Raiku Lane]
    - Drop Rate: 0.0% (Guaranteed Inclusion)
    - MEV/Slippage Loss: $0 (Pre-ordered execution)
    - Slot Utilization: ${raikuStats.slotsUtilized}%
    
    OBJECTIVE:
    Generate a high-fidelity "Execution Quality Report" for an institutional trader dashboard.
    
    OUTPUT FORMAT:
    Produce 3 distinct sections (keep them concise):
    
    1. ⚠️ DIAGNOSIS: specific technical analysis of why Legacy Solana failed in this '${scenario}' scenario (e.g., mention "UDP packet loss", "JIT auction spam", "Searcher contention", or "Mempool chaos").
    2. 🛡️ RAIKU MITIGATION: Explain how Raiku's AOT reservations and deterministic ordering solved the issue.
    3. 💰 ALPHA PRESERVED: Comment on the economic value saved (mention the $${mevSaved} figure) by avoiding drops and toxic MEV.

    TONE:
    Cybernetic, Institutional, Technical. Use Raiku terminology (AOT, JIT, Ackermann, Determinism).
    Do not use standard markdown headers (#). Use capitalized labels instead.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: {
        temperature: 0.5,
        thinkingConfig: { thinkingBudget: 2048 } // Use significant thinking budget for deep reasoning
      }
    });

    return response.text || "Ackermann Node: Telemetry stream interrupted.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Ackermann Node: Uplink unstable. Connection to Raiku Mainnet failed.";
  }
};