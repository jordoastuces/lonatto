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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Clé API Gemini manquante. Veuillez vérifier la configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

export async function fetchLotteryResults(country: string = "Togo", startDate?: string, endDate?: string, gameName?: string): Promise<LotteryResult[]> {
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

    const prompt = `RECHERCHE EXPERTE DE RÉSULTATS DE LOTERIE OFFICIELS :
    Nous sommes le ${today}.
    Pays cible : ${country}.
    Période : ${dateRangeContext}.
    Jeu : ${gameContext}.
    
    INSTRUCTIONS CRITIQUES :
    1. Utilise Google Search pour trouver les résultats RÉELS de FÉVRIER ${currentYear}.
    2. Cherche sur les sites officiels (lonato.tg), les journaux locaux (Togo Presse) et les sources de confiance.
    3. Si tu ne trouves pas le tirage exact d'aujourd'hui, renvoie les 5 derniers tirages officiels de ${currentYear}.
    4. Ne renvoie JAMAIS une liste vide si des tirages ont eu lieu récemment.
    5. Assure-toi que les numéros sont exacts.
    
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

    let cleanText = response.text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```/, "").replace(/```$/, "").trim();
    }
    
    return JSON.parse(cleanText);
  } catch (error: any) {
    console.error("Error fetching lottery results:", error);
    throw error;
  }
}

export async function chatWithGemini(message: string, history: { role: "user" | "model", parts: { text: string }[] }[]) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: history.map((h: any) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.parts[0].text }]
      })).concat([{ role: "user", parts: [{ text: message }] }]),
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    return { text: response.text };
  } catch (error: any) {
    console.error("Chat Error:", error);
    return { text: `⚠️ **Erreur** : ${error.message}\n\nLa clé API semble invalide ou mal configurée.` };
  }
}
