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

export async function chatWithGemini(message: string, history: { role: "user" | "model", parts: { text: string }[] }[], currentResults: LotteryResult[]) {
  try {
    const ai = getAI();
    const resultsContext = currentResults.length > 0 
      ? `Voici les données actuellement affichées sur l'application :\n${JSON.stringify(currentResults.slice(0, 20), null, 2)}`
      : "Aucune donnée n'est actuellement affichée sur l'application.";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: history.map((h: any) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.parts[0].text }]
      })).concat([{ role: "user", parts: [{ text: message }] }]),
      config: {
        systemInstruction: `Tu es l'Expert Lonato IA de l'application "Lonato World Pro". 
        
        RÈGLES CRITIQUES :
        1. Tu ne dois parler QUE des résultats de loterie, des statistiques et des fonctionnalités présentes sur cette application.
        2. Si l'utilisateur te pose une question hors sujet (politique, cuisine, sport général, etc.), réponds poliment que tu es spécialisé uniquement dans l'analyse des résultats Lonato et mondiaux présents sur l'app.
        3. Utilise les données fournies dans le contexte pour répondre précisément.
        4. Ne mentionne pas que tu es une IA de Google, présente-toi comme l'Expert Lonato IA.
        5. Si l'utilisateur demande des prédictions, précise qu'il s'agit de probabilités basées sur l'historique et non de certitudes.
        
        CONTEXTE ACTUEL :
        ${resultsContext}`,
        tools: [{ googleSearch: {} }]
      }
    });

    return { text: response.text };
  } catch (error: any) {
    console.error("Chat Error:", error);
    return { text: `⚠️ **Erreur** : ${error.message}\n\nLa clé API semble invalide ou mal configurée.` };
  }
}
