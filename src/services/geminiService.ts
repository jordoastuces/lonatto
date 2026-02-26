import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

async function getAI() {
  if (ai) return ai;
  
  try {
    const response = await fetch('/api/config');
    const { apiKey } = await response.json();
    if (apiKey) {
      ai = new GoogleGenAI({ apiKey });
      return ai;
    }
  } catch (e) {
    console.error("Failed to fetch API key from server", e);
  }
  return null;
}

export interface LotteryResult {
  country: string;
  gameName: string;
  date: string;
  winningNumbers: number[];
  machineNumbers?: number[];
  bonusNumbers?: number[];
  sourceUrl?: string;
}

export async function fetchLotteryResults(country: string = "Togo", startDate?: string, endDate?: string): Promise<LotteryResult[]> {
  const aiInstance = await getAI();
  const model = "gemini-3-flash-preview";
  
  const dateRangeContext = startDate && endDate 
    ? `entre le ${startDate} et le ${endDate}` 
    : "les plus récents (derniers tirages)";

  const prompt = `RECHERCHE ET EXTRACTION DES RÉSULTATS OFFICIELS (ANNÉE 2026) :
  Trouve les résultats réels, officiels et vérifiables de TOUS les tirages de loterie pour le pays : ${country}.
  Période demandée : ${dateRangeContext}. 
  IMPORTANT : Nous sommes actuellement en FÉVRIER 2026. Je veux absolument les résultats les plus récents de l'année 2026.
  
  JEUX REQUIS (doivent impérativement figurer dans la réponse) :
  - Lotto Sam (ou "Sam")
  - Diamond
  - Benz
  - Kadoo
  - Akwaaba
  - Et tous les autres tirages Lonato récents de 2026.

  CONSIGNES STRICTES :
  1. Utilise Google Search pour trouver les tirages de JANVIER et FÉVRIER 2026 sur les sites officiels (lonato.tg, etc.) ou les journaux locaux fiables.
  2. Ne fournis QUE des données réelles. Si un résultat n'est pas trouvé, ne l'invente pas.
  3. Pour CHAQUE résultat, fournis l'URL de la source où tu as trouvé l'information.
  4. Inclus au moins 30 tirages pour garantir une couverture complète.
  5. Format : Nom exact du jeu, date (JJ/MM/AAAA), numéros gagnants, URL source.`;

  try {
    if (!aiInstance) {
      console.warn("Gemini API key is missing. Skipping fetch.");
      return [];
    }
    const response = await aiInstance.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: "Tu es un extracteur de données de loterie de haute précision. Ta mission est de trouver les résultats réels et exacts sur le web. Tu dois impérativement citer tes sources (URL). Ne génère jamais de faux numéros.",
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
              winningNumbers: { 
                type: Type.ARRAY, 
                items: { type: Type.INTEGER } 
              },
              machineNumbers: { 
                type: Type.ARRAY, 
                items: { type: Type.INTEGER } 
              },
              bonusNumbers: { 
                type: Type.ARRAY, 
                items: { type: Type.INTEGER } 
              },
              sourceUrl: { type: Type.STRING, description: "L'URL de la page web où le résultat a été trouvé" },
            },
            required: ["country", "gameName", "date", "winningNumbers", "sourceUrl"]
          }
        }
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Error fetching lottery results:", error);
    return [];
  }
}

export async function chatWithGemini(message: string, history: { role: "user" | "model", parts: { text: string }[] }[]) {
  const aiInstance = await getAI();
  if (!aiInstance) {
    return { text: "Le service d'IA est actuellement indisponible car la clé API n'est pas configurée. Veuillez ajouter VITE_GEMINI_API_KEY dans vos variables d'environnement." };
  }
  const model = "gemini-3.1-pro-preview";
  
  const chat = aiInstance.chats.create({
    model: model,
    config: {
      systemInstruction: "Tu es un expert en résultats de loterie Lonato et mondiaux. Aide les utilisateurs à trouver des résultats, comprendre les jeux et donne des informations basées sur les données réelles. Sois précis et professionnel.",
      tools: [{ googleSearch: {} }]
    },
    history: history
  });

  const result = await chat.sendMessage({ message });
  return result;
}
