/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  RefreshCw, 
  Globe, 
  MessageSquare, 
  X, 
  Send, 
  ChevronRight, 
  History,
  Trophy,
  Calendar,
  Loader2,
  TrendingUp,
  ArrowUpDown,
  BarChart3,
  Hash,
  Layers,
  Bell,
  BellOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchLotteryResults, chatWithGemini, LotteryResult } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Markdown from 'react-markdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COUNTRIES = [
  { name: 'Togo', code: 'TG' },
  { name: 'Bénin', code: 'BJ' },
  { name: 'Côte d\'Ivoire', code: 'CI' },
  { name: 'Ghana', code: 'GH' },
  { name: 'Nigeria', code: 'NG' },
  { name: 'France', code: 'FR' },
  { name: 'Italie', code: 'IT' },
  { name: 'USA', code: 'US' },
];

export default function App() {
  const [results, setResults] = useState<LotteryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{ online: boolean, message: string } | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('Togo');
  const [selectedGame, setSelectedGame] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [activeTab, setActiveTab] = useState<'results' | 'stats'>('results');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "model", parts: { text: string }[] }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const subscribeToNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert("Les notifications push ne sont pas supportées par votre navigateur.");
      return;
    }

    setNotificationLoading(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const response = await fetch('/api/vapid-public-key');
      const { publicKey } = await response.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, country: selectedCountry })
      });

      setIsSubscribed(true);
    } catch (error) {
      console.error("Subscription failed:", error);
      alert("Impossible de s'abonner aux notifications.");
    } finally {
      setNotificationLoading(false);
    }
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        setApiStatus(data);
      } catch (e) {
        setApiStatus({ online: false, message: "Serveur injoignable" });
      }
    };
    checkStatus();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        reg?.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const loadResults = async (country: string, forceRefresh = false, start?: string, end?: string, game?: string) => {
    const isCustomRange = start && end;
    const cacheKey = isCustomRange 
      ? `lottery_${country}_${start}_${end}_${game || 'all'}`
      : `lottery_${country}_latest`;
    
    if (!forceRefresh) {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          setResults(parsed);
          setIsFromCache(true);
          setLoading(false);
          return;
        } catch (e) {
          console.error("Cache parse error", e);
        }
      }
    }

    setLoading(true);
    setError(null);
    setIsFromCache(false);
    try {
      const data = await fetchLotteryResults(country, start, end, game);
      setResults(data);
      setLastUpdated(new Date().toLocaleTimeString());
      if (data && data.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } else if (!isCustomRange) {
        setError("Aucun résultat récent trouvé pour ce pays.");
      }
    } catch (error: any) {
      console.error(error);
      setError(error.message || "Une erreur est survenue lors de la récupération.");
    } finally {
      setLoading(false);
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    // Robust date parsing for JJ/MM/AAAA or standard formats
    const parseDate = (dateStr: string) => {
      const parts = dateStr.split(/[\/\-]/);
      if (parts.length === 3) {
        // Assume JJ/MM/AAAA
        if (parts[2].length === 4) {
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
        }
        // Assume AAAA/MM/JJ
        if (parts[0].length === 4) {
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
        }
      }
      return new Date(dateStr).getTime();
    };

    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);
    
    if (isNaN(dateA) || isNaN(dateB)) {
      return sortOrder === 'desc' 
        ? b.date.localeCompare(a.date) 
        : a.date.localeCompare(b.date);
    }
    
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const filteredResults = useMemo(() => {
    if (selectedGame === 'All') return sortedResults;
    return sortedResults.filter(r => r.gameName.toLowerCase().includes(selectedGame.toLowerCase()));
  }, [sortedResults, selectedGame]);

  const availableGames = useMemo(() => {
    const games = Array.from(new Set(results.map(r => r.gameName))).sort();
    const list = ['All', ...games];
    // Ensure Lotto Sam is visible if it's a common request
    if (!list.some(g => g.toLowerCase().includes('sam'))) {
      list.push('Lotto Sam');
    }
    return list;
  }, [results]);

  const stats = useMemo(() => {
    const frequency: Record<number, number> = {};
    const pairs: Record<string, number> = {};

    results.forEach(res => {
      const nums = res.winningNumbers;
      nums.forEach(n => {
        frequency[n] = (frequency[n] || 0) + 1;
      });

      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const pair = [nums[i], nums[j]].sort((a, b) => a - b).join('-');
          pairs[pair] = (pairs[pair] || 0) + 1;
        }
      }
    });

    const sortedFreq = Object.entries(frequency)
      .map(([num, count]) => ({ num: parseInt(num), count }))
      .sort((a, b) => b.count - a.count);

    const sortedPairs = Object.entries(pairs)
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count);

    return { frequency: sortedFreq, pairs: sortedPairs };
  }, [results]);

  useEffect(() => {
    loadResults(selectedCountry, false, startDate, endDate, selectedGame);
  }, [selectedCountry, startDate, endDate, selectedGame]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput;
    setChatInput('');
    const newHistory = [...chatHistory, { role: "user" as const, parts: [{ text: userMessage }] }];
    setChatHistory(newHistory);
    setIsChatLoading(true);

    try {
      const response = await chatWithGemini(userMessage, newHistory);
      setChatHistory([...newHistory, { role: "model" as const, parts: [{ text: response.text || "Désolé, je n'ai pas pu répondre." }] }]);
    } catch (error) {
      console.error(error);
      setChatHistory([...newHistory, { role: "model" as const, parts: [{ text: "Une erreur est survenue lors de la communication avec l'IA." }] }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-2xl mx-auto relative overflow-hidden shadow-2xl border-x border-slate-200">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-6 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-red via-brand-green to-brand-blue rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                <Trophy className="text-brand-gold w-6 h-6" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={cn("w-2 h-2 rounded-full animate-pulse", apiStatus?.online ? "bg-emerald-500" : "bg-red-500")} />
                <span className={cn("text-[10px] font-black uppercase tracking-[0.3em]", apiStatus?.online ? "text-emerald-600" : "text-red-600")}>
                  {apiStatus?.online ? "Serveur OK" : "API Error"}
                </span>
              </div>
              <h1 className="font-serif italic text-3xl tracking-tighter text-slate-900 leading-none">Lonato World</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={subscribeToNotifications}
              disabled={notificationLoading || isSubscribed}
              className={cn(
                "p-2.5 rounded-xl transition-all duration-300 border",
                isSubscribed 
                  ? "text-brand-blue bg-blue-50 border-blue-100" 
                  : "text-slate-400 bg-slate-50 border-slate-100 hover:border-brand-blue hover:text-brand-blue"
              )}
            >
              {notificationLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSubscribed ? (
                <Bell className="w-5 h-5 fill-current" />
              ) : (
                <BellOff className="w-5 h-5" />
              )}
            </button>
            <button 
              onClick={() => loadResults(selectedCountry, true, startDate, endDate)}
              className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
              disabled={loading}
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 space-y-10 pb-24">
        {/* Hero / Country Selector */}
        <section className="space-y-6">
          <div className="relative">
            <div className="section-header">
              <Globe className="w-3 h-3 text-brand-blue" />
              Territoire de Tirage
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
              {COUNTRIES.map((country) => (
                <button
                  key={country.code}
                  onClick={() => setSelectedCountry(country.name)}
                  className={cn(
                    "px-6 py-3 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all duration-300 border",
                    selectedCountry === country.name
                      ? "bg-brand-blue text-white border-brand-blue shadow-xl shadow-blue-100 scale-105"
                      : "bg-white text-slate-500 border-slate-200 hover:border-brand-blue hover:text-brand-blue"
                  )}
                >
                  {country.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="section-header">
              <Calendar className="w-3 h-3 text-brand-red" />
              Filtre Temporel
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">Date de début</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-red outline-none transition-all font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">Date de fin</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-red outline-none transition-all font-medium"
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex items-center justify-between">
              {(startDate || endDate) ? (
                <button 
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-[10px] text-brand-red font-bold uppercase tracking-widest hover:text-red-700 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Réinitialiser
                </button>
              ) : <div />}
              
              <button 
                onClick={() => loadResults(selectedCountry, true, startDate, endDate, selectedGame)}
                className="px-6 py-3 bg-brand-blue text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
              >
                <Search className="w-3 h-3" />
                Rechercher l'historique
              </button>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-200/50 p-1.5 rounded-[2rem] border border-slate-200 shadow-inner">
          <button
            onClick={() => setActiveTab('results')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[1.75rem] text-xs font-bold transition-all duration-500",
              activeTab === 'results' 
                ? "bg-white text-slate-900 shadow-xl" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <History className={cn("w-4 h-4", activeTab === 'results' ? "text-brand-blue" : "")} />
            Tirages Officiels
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[1.75rem] text-xs font-bold transition-all duration-500",
              activeTab === 'stats' 
                ? "bg-white text-slate-900 shadow-xl" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <BarChart3 className={cn("w-4 h-4", activeTab === 'stats' ? "text-brand-green" : "")} />
            Intelligence Data
          </button>
        </div>

        {activeTab === 'results' ? (
          <div className="space-y-8">
            {/* Results Control Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="section-header mb-0">
                  <Trophy className="w-3 h-3" />
                  {startDate || endDate ? 'Archives Historiques' : 'Flux de Résultats'}
                </div>
                {isFromCache && (
                  <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-slate-200">
                    Offline
                  </span>
                )}
              </div>
              <button 
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-brand-blue transition-colors"
              >
                <ArrowUpDown className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                {sortOrder === 'desc' ? 'Chronologique inverse' : 'Chronologique'}
              </button>
            </div>

            {/* Game Filter Chips */}
            {!loading && availableGames.length > 2 && (
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {availableGames.map((game) => (
                  <button
                    key={game}
                    onClick={() => setSelectedGame(game)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 border whitespace-nowrap",
                      selectedGame === game
                        ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                        : "bg-white text-slate-400 border-slate-100 hover:border-brand-blue hover:text-brand-blue"
                    )}
                  >
                    {game}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-6">
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-brand-blue rounded-full" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-slate-900 font-bold uppercase tracking-widest">Synchronisation...</p>
                  <p className="text-xs text-slate-400">Extraction des données Lonato en cours</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-white rounded-[2.5rem] p-12 border-2 border-dashed border-red-100 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                  <BellOff className="w-6 h-6 text-red-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-red-900 font-bold uppercase tracking-widest">Erreur API</p>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
                <button 
                  onClick={() => loadResults(selectedCountry, true, startDate, endDate, selectedGame)}
                  className="px-6 py-2.5 bg-brand-red text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all"
                >
                  Réessayer la connexion
                </button>
              </div>
            ) : filteredResults.length > 0 ? (
              <div className="grid gap-6">
                {filteredResults.map((result, idx) => (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    key={`${result.gameName}-${result.date}`}
                    className="group bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200 transition-all duration-500 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    
                    <div className="flex justify-between items-start mb-8 relative z-10">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-brand-red/10 text-brand-red text-[8px] font-black uppercase tracking-[0.2em] rounded-md">
                            {result.gameName.includes('Sam') ? 'Premium' : 'Standard'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">#{idx + 1}</span>
                        </div>
                        <h3 className="font-serif italic text-3xl text-slate-900 leading-none mb-2">{result.gameName}</h3>
                        <div className="flex items-center gap-2 text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{result.date}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">{result.country}</div>
                        <div className="w-8 h-1 bg-brand-blue ml-auto rounded-full mb-2" />
                        {result.sourceUrl && (
                          <a 
                            href={result.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[8px] font-bold text-brand-blue uppercase tracking-widest hover:underline flex items-center justify-end gap-1"
                          >
                            Source <Globe className="w-2 h-2" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="space-y-8 relative z-10">
                      <div>
                        <div className="section-header mb-3">
                          <Hash className="w-3 h-3" />
                          Séquence Gagnante
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {result.winningNumbers.map((num, i) => {
                            const colors = ['bg-brand-red', 'bg-brand-green', 'bg-brand-blue'];
                            const colorClass = colors[i % colors.length];
                            return (
                              <motion.div 
                                key={i} 
                                whileHover={{ y: -5 }}
                                className={cn("w-14 h-14 rounded-2xl text-white flex items-center justify-center font-mono text-xl font-bold shadow-xl shadow-slate-200", colorClass)}
                              >
                                {num < 10 ? `0${num}` : num}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>

                      {(result.machineNumbers && result.machineNumbers.length > 0) && (
                        <div>
                          <div className="section-header mb-3">
                            <Layers className="w-3 h-3" />
                            Numéros Machine
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {result.machineNumbers.map((num, i) => (
                              <div key={i} className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-100 text-slate-400 flex items-center justify-center font-mono text-lg font-bold">
                                {num < 10 ? `0${num}` : num}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] p-12 border-2 border-dashed border-slate-100 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6 text-slate-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-900 font-bold uppercase tracking-widest">Aucune donnée</p>
                  <p className="text-xs text-slate-400">Les archives pour ce pays sont actuellement vides.</p>
                </div>
                <button 
                  onClick={() => loadResults(selectedCountry, true, startDate, endDate, selectedGame)}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Forcer la recherche
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            <div className="section-header">
              <TrendingUp className="w-3 h-3" />
              Analyse Prédictive & Fréquentielle
            </div>

            {results.length === 0 ? (
              <div className="bg-white rounded-[2.5rem] p-12 border-2 border-dashed border-slate-100 text-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Données insuffisantes pour l'analyse</p>
              </div>
            ) : (
              <div className="grid gap-8">
                {/* Frequency Card */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Hash className="w-24 h-24" />
                  </div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                      <Hash className="w-5 h-5 text-brand-blue" />
                    </div>
                    <div>
                      <h3 className="font-serif italic text-2xl text-slate-900">Fréquence d'Apparition</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Top 10 des numéros les plus tirés</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {stats.frequency.slice(0, 10).map((item, idx) => {
                      const maxCount = stats.frequency[0].count;
                      const percentage = (item.count / maxCount) * 100;
                      return (
                        <div key={item.num} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-mono font-black text-slate-900">{item.num < 10 ? `0${item.num}` : item.num}</span>
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Rang #{idx + 1}</span>
                            </div>
                            <span className="text-xs font-black text-brand-blue">{item.count} <span className="text-[10px] text-slate-400 font-normal">Tirages</span></span>
                          </div>
                          <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                            <motion.div 
                              initial={{ width: 0 }}
                              whileInView={{ width: `${percentage}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className="h-full bg-brand-green rounded-full shadow-[0_0_10px_rgba(39,174,96,0.3)]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Common Pairs Card */}
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-300">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Layers className="w-24 h-24" />
                  </div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                      <Layers className="w-5 h-5 text-brand-gold" />
                    </div>
                    <div>
                      <h3 className="font-serif italic text-2xl">Paires Dominantes</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Combinaisons de 2 numéros récurrentes</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {stats.pairs.slice(0, 8).map((item, idx) => (
                      <div key={item.pair} className="bg-white/5 p-5 rounded-3xl border border-white/10 flex flex-col items-center group hover:bg-white/10 transition-all duration-300">
                        <div className="flex gap-2 mb-3">
                          {item.pair.split('-').map(n => (
                            <span key={n} className="w-10 h-10 rounded-xl bg-white text-slate-900 flex items-center justify-center text-sm font-black font-mono shadow-lg">
                              {parseInt(n) < 10 ? `0${n}` : n}
                            </span>
                          ))}
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] font-black text-brand-green uppercase tracking-[0.2em] mb-1">{item.count} Fois</div>
                          <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Fréquence de Paire</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Hero Section */}
        <section className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl shadow-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 transition-transform duration-700 group-hover:scale-110" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200">
                <TrendingUp className="w-6 h-6 text-brand-gold" />
              </div>
              <div>
                <h2 className="font-serif italic text-3xl text-slate-900">IA Prédictive</h2>
                <p className="text-[10px] font-black text-brand-blue uppercase tracking-[0.3em]">Module de Probabilité</p>
              </div>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-xs">
              Exploitez la puissance de Gemini 3.1 pour analyser les tendances historiques et optimiser vos sélections basées sur les données réelles.
            </p>
            <button 
              onClick={() => setIsChatOpen(true)}
              className="w-full bg-slate-900 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
              Consulter l'Expert IA
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      {/* Floating Action Button for Chat */}
      {!isChatOpen && (
        <motion.button
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-slate-900 text-white rounded-[2rem] shadow-2xl shadow-slate-300 flex items-center justify-center z-40 group"
        >
          <MessageSquare className="w-7 h-7 group-hover:scale-110 transition-transform" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-red rounded-full border-2 border-white" />
        </motion.button>
      )}

      {/* Chat Interface Overlay */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 bg-white z-50 flex flex-col max-w-2xl mx-auto shadow-2xl"
          >
            <div className="px-8 py-6 border-b flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <MessageSquare className="w-6 h-6 text-brand-blue" />
                </div>
                <div>
                  <h3 className="font-serif italic text-xl">Expert Lonato IA</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-brand-green rounded-full animate-pulse" />
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Système Connecté</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="p-3 hover:bg-white/10 rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50 no-scrollbar">
              {chatHistory.length === 0 && (
                <div className="text-center py-16 space-y-8">
                  <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200 flex items-center justify-center mx-auto border border-slate-100">
                    <Trophy className="w-10 h-10 text-brand-gold" />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-slate-900 font-serif italic text-2xl">Comment puis-je vous aider ?</h4>
                    <p className="text-slate-400 text-xs font-medium px-12 leading-relaxed">
                      Je suis programmé pour analyser les tirages Lonato et mondiaux. Posez-moi vos questions sur les tendances ou les résultats spécifiques.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 px-6">
                    {["Derniers résultats Togo", "Numéros fréquents", "Probabilités Sam"].map((hint) => (
                      <button 
                        key={hint}
                        onClick={() => setChatInput(hint)}
                        className="text-[10px] font-bold uppercase tracking-widest bg-white border border-slate-200 px-5 py-3 rounded-2xl text-slate-600 hover:border-brand-blue hover:text-brand-blue transition-all shadow-sm"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {chatHistory.map((msg, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex flex-col max-w-[90%] space-y-2",
                    msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div 
                    className={cn(
                      "p-5 rounded-[2rem] text-sm leading-relaxed shadow-sm",
                      msg.role === "user" 
                        ? "bg-slate-900 text-white rounded-tr-none" 
                        : "bg-white border border-slate-100 text-slate-800 rounded-tl-none"
                    )}
                  >
                    <div className="markdown-body prose prose-sm max-w-none prose-slate">
                      <Markdown>{msg.parts[0].text}</Markdown>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] px-2">
                    {msg.role === "user" ? "Utilisateur" : "Intelligence Artificielle"}
                  </span>
                </div>
              ))}
              
              {isChatLoading && (
                <div className="flex flex-col mr-auto items-start max-w-[90%]">
                  <div className="bg-white border border-slate-100 p-6 rounded-[2rem] rounded-tl-none shadow-sm">
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-6 border-t bg-white flex gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Interroger l'expert..."
                className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-blue transition-all outline-none"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="bg-slate-900 text-white p-4 rounded-2xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xl shadow-slate-200"
              >
                <Send className="w-6 h-6" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
