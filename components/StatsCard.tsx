import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  color?: 'raiku' | 'solana' | 'red' | 'gray';
}

export const StatsCard: React.FC<StatsCardProps> = ({ label, value, subValue, icon, color = 'gray' }) => {
  const colorClasses = {
    raiku: 'text-raiku-500 border-raiku-900 bg-raiku-900/10',
    solana: 'text-solana-500 border-solana-600/30 bg-solana-600/10',
    red: 'text-red-500 border-red-900 bg-red-900/10',
    gray: 'text-slate-400 border-slate-800 bg-slate-900/50',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]} flex flex-col gap-2 transition-all duration-300`}>
      <div className="flex items-center justify-between opacity-80">
        <span className="text-xs font-mono uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold font-mono tracking-tight">{value}</div>
      {subValue && <div className="text-xs opacity-60">{subValue}</div>}
    </div>
  );
};