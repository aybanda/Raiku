import { GoogleGenAI } from "@google/genai";
import { SimulationStats, ExecutionMode } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSimulation = async (
  legacyStats: SimulationStats,
  raikuStats: SimulationStats
): Promise<string> => {
  
  const prompt = `
    Act as a senior blockchain economist and systems architect researching Solana blockspace markets.
    
    Analyze the following simulation data comparing "Legacy Probabilistic Execution" vs "Raiku Deterministic Execution".
    
    DATA:
    Legacy (Standard Solana):
    - Transaction Drop Rate: ${((legacyStats.droppedTx / legacyStats.totalTx) * 100).toFixed(1)}%
    - Network Jitter: ${legacyStats.jitter}ms
    - Simulated MEV Loss: $${legacyStats.mevLost.toLocaleString()}
    
    Raiku (Deterministic/AOT):
    - Transaction Drop Rate: ${((raikuStats.droppedTx / raikuStats.totalTx) * 100).toFixed(1)}%
    - Network Jitter: ${raikuStats.jitter}ms (Guaranteed Slots)
    - Simulated MEV Loss: $${raikuStats.mevLost.toLocaleString()}
    
    TASK:
    Provide a concise, high-impact executive summary (max 3 short paragraphs) explaining:
    1. The financial impact of uncertainty (Legacy) on institutional traders.
    2. How Raiku's Ahead-of-Time (AOT) slot reservations solve the "spray and pray" spam problem.
    3. A projection of how this enables new financial primitives (e.g., deterministic liquidations).
    
    Tone: Professional, Technical, "Hacker-Hotel" vibe.
    Do not use markdown bolding excessively.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Using the advanced reasoning model
      contents: prompt,
      config: {
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 1024 } // Utilizing thinking tokens for deeper economic analysis
      }
    });

    return response.text || "Analysis complete. Waiting for data stream...";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "The Ackermann Node is temporarily unreachable. AI Analysis offline.";
  }
};