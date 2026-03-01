import { GoogleGenAI, Type } from "@google/genai";

export interface LotteryResult {
  country: string;
  gameName: string;
  date: string;
  winningNumbers: number[];
  machineNumbers?: number[];
  bonusNumbers?: number[];
  sourceUrl?: string;
}

const getAI = () => {
  // Try multiple sources for the API key
  const apiKey = 
    (import.meta as any).env?.VITE_GEMINI_API_KEY || 
    (window as any).process?.env?.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("Clé API Gemini manquante. Veuillez configurer la variable GEMINI_API_KEY dans les paramètres de l'application.");
  }
  return new GoogleGenAI({ apiKey });
};

// Fonction utilitaire pour attendre (sleep)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchLotteryResults(country: string = "Togo", startDate?: string, endDate?: string, gameName?: string): Promise<LotteryResult[]> {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      const ai = getAI();
      const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const currentYear = new Date().getFullYear();

      const dateRangeContext = startDate && endDate 
        ? `entre le ${startDate} et le ${endDate}` 
        : "les plus récents (derniers tirages)";

      const gameContext = gameName && gameName !== 'All' 
        ? `spécifiquement pour le jeu "${gameName}"` 
        : "pour tous les jeux disponibles (Lotto Sam, Diamond, Benz, Kadoo, Akwaaba, etc.)";

      const prompt = `RECHERCHE EXHAUSTIVE DE RÉSULTATS DE LOTERIE OFFICIELS :
      Nous sommes le ${today}.
      Pays cible : ${country}.
      Période : ${dateRangeContext}.
      Jeu : ${gameContext}.
      
      INSTRUCTIONS CRITIQUES POUR UNE COUVERTURE TOTALE :
      1. Tu DOIS trouver les résultats pour CHAQUE JOUR de la période demandée où un tirage a eu lieu.
      2. Pour le Togo (LONATO), vérifie spécifiquement : DIAMANT (Lundi), BENZ (Mardi), KADOO (Mercredi), SAM (Jeudi), AKWAABA (Vendredi).
      3. Ne te limite pas aux 5 derniers. Si la période couvre 10 jours, je veux les 10 jours de résultats.
      4. Utilise Google Search pour consulter les "résultats loto ${country} ${currentYear}" sur des sites comme lonato.tg, loto-togo.com, ou les pages de résultats officiels.
      5. Pour chaque tirage, fournis : Nom du jeu, Date exacte, les 5 numéros gagnants (Winning Numbers) et les 5 numéros machine (Machine Numbers).
      6. Si tu ne trouves pas de résultats pour un jour spécifique, continue de chercher pour les jours précédents jusqu'à avoir une liste chronologique complète sans "trous" inexpliqués.
      7. Assure-toi que les dates sont au format JJ/MM/AAAA.
      
      Format attendu : Un tableau JSON d'objets.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          systemInstruction: "Tu es un agent spécialisé dans l'extraction de résultats de loterie. Tu DOIS utiliser Google Search pour obtenir des données en temps réel. Renvoie UNIQUEMENT un tableau JSON valide. Ne réponds pas par du texte, seulement le JSON.",
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                country: { type: Type.STRING },
                gameName: { type: Type.STRING },
                date: { type: Type.STRING },
                winningNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                machineNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                sourceUrl: { type: Type.STRING }
              },
              required: ["country", "gameName", "date", "winningNumbers"]
            }
          }
        }
      });

      const text = response.text;
      if (!text || text.trim() === "") {
        return [];
      }
      
      let cleanText = text.trim();
      if (cleanText.includes("```")) {
        const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          cleanText = jsonMatch[1].trim();
        } else {
          cleanText = cleanText.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
        }
      }
      
      if (cleanText === "") return [];

      try {
        return JSON.parse(cleanText);
      } catch (error: any) {
        throw new Error(`Format de données invalide : ${error.message}`);
      }
    } catch (error: any) {
      const isQuotaError = error.message?.toLowerCase().includes("429") || error.message?.toLowerCase().includes("quota");
      
      if (isQuotaError && retries < maxRetries - 1) {
        retries++;
        const waitTime = 5000 * retries; // Attend 5s, puis 10s
        console.warn(`Quota atteint. Tentative ${retries}/${maxRetries} après ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      console.error("Error fetching lottery results:", error);
      if (isQuotaError) {
        throw new Error("Le service de recherche Google est saturé. Veuillez patienter 30 à 60 secondes avant de réessayer.");
      }
      throw error;
    }
  }
  return [];
}
