export interface LotteryResult {
  country: string;
  gameName: string;
  date: string;
  winningNumbers: number[];
  machineNumbers?: number[];
  bonusNumbers?: number[];
  sourceUrl?: string;
}

export async function fetchLotteryResults(country: string = "Togo", startDate?: string, endDate?: string, gameName?: string): Promise<LotteryResult[]> {
  try {
    const response = await fetch('/api/lottery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country, startDate, endDate, gameName })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Erreur lors de la récupération des résultats.");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching lottery results:", error);
    return [];
  }
}

export async function chatWithGemini(message: string, history: { role: "user" | "model", parts: { text: string }[] }[]) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Erreur serveur lors du chat.");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Chat Error:", error);
    return { text: `⚠️ **Erreur** : ${error.message}\n\nAssurez-vous que la clé API est bien configurée dans Render (onglet Environment) sous le nom \`VITE_GEMINI_API_KEY\`.` };
  }
}
