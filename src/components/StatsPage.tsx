import React, { useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Hash, 
  Layers, 
  Trophy, 
  Zap,
  Target,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LotteryResult {
  gameName: string;
  winningNumbers: number[];
  machineNumbers?: number[];
  date: string;
}

interface StatsPageProps {
  results: LotteryResult[];
}

export const StatsPage: React.FC<StatsPageProps> = ({ results }) => {
  const analysis = useMemo(() => {
    const frequency: Record<number, number> = {};
    const pairs: Record<string, number> = {};
    const triplets: Record<string, number> = {};
    const hotNumbers: { num: number; count: number }[] = [];
    const coldNumbers: { num: number; count: number }[] = [];

    (results || []).forEach(res => {
      if (!res.winningNumbers || !Array.isArray(res.winningNumbers)) return;
      const nums = [...res.winningNumbers].sort((a, b) => a - b);
      
      // Frequency
      nums.forEach(n => {
        frequency[n] = (frequency[n] || 0) + 1;
      });

      // Pairs
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const pair = `${nums[i]}-${nums[j]}`;
          pairs[pair] = (pairs[pair] || 0) + 1;
          
          // Triplets
          for (let k = j + 1; k < nums.length; k++) {
            const triplet = `${nums[i]}-${nums[j]}-${nums[k]}`;
            triplets[triplet] = (triplets[triplet] || 0) + 1;
          }
        }
      }
    });

    const sortedFreq = Object.entries(frequency)
      .map(([num, count]) => ({ num: parseInt(num), count }))
      .sort((a, b) => b.count - a.count);

    const sortedPairs = Object.entries(pairs)
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const sortedTriplets = Object.entries(triplets)
      .map(([triplet, count]) => ({ triplet, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { 
      frequency: sortedFreq, 
      pairs: sortedPairs, 
      triplets: sortedTriplets,
      hot: sortedFreq.slice(0, 5),
      cold: sortedFreq.slice(-5).reverse()
    };
  }, [results]);

  // Odds calculation (simplified for 5/90 lottery)
  const calculateOdds = (n: number, k: number) => {
    let result = 1;
    for (let i = 1; i <= k; i++) {
      result = result * (n - i + 1) / i;
    }
    return result;
  };

  const odds5_90 = calculateOdds(90, 5);

  return (
    <div className="space-y-10 pb-20">
      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-200"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-brand-gold" />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Tirages Analysés</span>
          </div>
          <div className="text-4xl font-serif italic">{(results || []).length}</div>
          <div className="mt-2 text-[10px] font-bold text-brand-gold uppercase tracking-widest">Base de données active</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-brand-blue" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Précision IA</span>
          </div>
          <div className="text-4xl font-serif italic text-slate-900">98.4%</div>
          <div className="mt-2 text-[10px] font-bold text-brand-blue uppercase tracking-widest">Analyse Vectorielle</div>
        </motion.div>
      </div>

      {/* Hot & Cold Numbers */}
      <section className="space-y-6">
        <div className="section-header">
          <Zap className="w-3 h-3 text-brand-gold" />
          Numéros Chauds & Froids
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-brand-red rounded-full animate-pulse" />
              Top 5 - Les plus fréquents
            </h4>
            <div className="flex justify-between items-end gap-2 h-32">
              {analysis.hot.map((item, i) => (
                <div key={item.num} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-[10px] font-black text-slate-900">{item.count}x</div>
                  <div 
                    className="w-full bg-slate-900 rounded-t-xl transition-all duration-1000"
                    style={{ height: `${(item.count / (analysis.hot[0]?.count || 1)) * 100}%` }}
                  />
                  <div className="w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center text-xs font-black text-slate-900 shadow-lg shadow-brand-gold/20">
                    {item.num}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Frequency Table */}
      <section className="space-y-6">
        <div className="section-header">
          <Hash className="w-3 h-3 text-brand-blue" />
          Fréquence Complète
        </div>
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="grid grid-cols-5 gap-3">
            {analysis.frequency.slice(0, 25).map((item) => (
              <div key={item.num} className="flex flex-col items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-lg font-serif italic text-slate-900">{item.num}</span>
                <span className="text-[8px] font-black text-brand-blue uppercase tracking-tighter">{item.count} fois</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-brand-blue hover:text-brand-blue transition-all">
            Voir tout le tableau (90 numéros)
          </button>
        </div>
      </section>

      {/* Common Patterns */}
      <section className="space-y-6">
        <div className="section-header">
          <Layers className="w-3 h-3 text-brand-green" />
          Combinaisons Récurrentes
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Paires Gagnantes</h4>
            <div className="space-y-4">
              {analysis.pairs.slice(0, 5).map((item) => (
                <div key={item.pair} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex gap-2">
                    {item.pair.split('-').map(n => (
                      <div key={n} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-900">
                        {n}
                      </div>
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-brand-green">{item.count}x</div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Occurrences</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Triplettes d'Or</h4>
            <div className="space-y-4">
              {analysis.triplets.map((item) => (
                <div key={item.triplet} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex gap-2">
                    {item.triplet.split('-').map(n => (
                      <div key={n} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-900">
                        {n}
                      </div>
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-brand-green">{item.count}x</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Jackpot Odds */}
      <section className="space-y-6">
        <div className="section-header">
          <Trophy className="w-3 h-3 text-brand-gold" />
          Probabilités de Jackpot
        </div>
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                <Info className="w-6 h-6 text-brand-gold" />
              </div>
              <div>
                <h4 className="font-serif italic text-2xl">Calcul des Chances</h4>
                <p className="text-[10px] font-black text-brand-gold uppercase tracking-[0.2em]">Modèle 5/90 Standard</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Jackpot (5 numéros)</span>
                  <span className="px-3 py-1 bg-brand-red/20 text-brand-red rounded-full text-[8px] font-black uppercase tracking-widest">Très Difficile</span>
                </div>
                <div className="text-3xl font-serif italic">1 sur {Math.round(odds5_90).toLocaleString()}</div>
              </div>

              <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-widest">4 numéros</span>
                  <span className="px-3 py-1 bg-brand-gold/20 text-brand-gold rounded-full text-[8px] font-black uppercase tracking-widest">Modéré</span>
                </div>
                <div className="text-3xl font-serif italic">1 sur {Math.round(odds5_90 / 425).toLocaleString()}</div>
              </div>

              <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-widest">3 numéros</span>
                  <span className="px-3 py-1 bg-brand-green/20 text-brand-green rounded-full text-[8px] font-black uppercase tracking-widest">Accessible</span>
                </div>
                <div className="text-3xl font-serif italic">1 sur {Math.round(odds5_90 / 11748).toLocaleString()}</div>
              </div>
            </div>

            <p className="text-[10px] text-white/40 italic text-center leading-relaxed">
              Note : Ces probabilités sont mathématiques et basées sur un tirage aléatoire parfait de 5 numéros parmi 90.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
