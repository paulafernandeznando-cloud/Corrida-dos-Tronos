
import { GoogleGenAI } from "@google/genai";
import { Coordinates, GeminiResponseData, Place, LeaderboardEntry, GroundingChunk } from "../types";

// Helper to generate mock leaderboard data for "Corrida dos Tronos"
const generateMockLeaderboard = (): LeaderboardEntry[] => {
  const names = ["João 'O Flash'", "Maria Maratona", "Rei Arthur", "Ana Velocity", "Pedro Pace", "Rainha da Pista", "Lorde Corredor"];
  const colors = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-red-500"];
  
  // Shuffle names
  const shuffled = names.sort(() => 0.5 - Math.random());
  
  // Base visits count (high number for the king)
  let currentVisits = Math.floor(Math.random() * 50) + 30;

  return [
    {
      rank: 1,
      name: shuffled[0],
      visits: currentVisits,
      avatarColor: colors[Math.floor(Math.random() * colors.length)]
    },
    {
      rank: 2,
      name: shuffled[1],
      visits: currentVisits - Math.floor(Math.random() * 10) - 1,
      avatarColor: colors[Math.floor(Math.random() * colors.length)]
    },
    {
      rank: 3,
      name: shuffled[2],
      visits: Math.floor(currentVisits / 2),
      avatarColor: colors[Math.floor(Math.random() * colors.length)]
    }
  ];
};

export const fetchRunningRoutes = async (
  query: string, 
  location?: Coordinates
): Promise<GeminiResponseData> => {
  try {
    // Initialize AI inside the call to ensure process.env.API_KEY is defined
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = "gemini-2.5-flash";
    
    // Construct a context-aware prompt that specifically requests JSON
    const prompt = `
      Atue como um treinador de corrida profissional local.
      O usuário quer saber onde correr em: "${query}".
      
      Use o Google Maps para encontrar 4 a 5 locais ótimos para corrida.
      
      IMPORTANTE: Sua resposta final deve conter APENAS um bloco de código JSON.
      Não inclua texto de conversação fora do JSON.
      
      O formato do JSON deve ser estritamente este array de objetos:
      [
        {
          "name": "Nome do Local",
          "lat": 0.0000, // Latitude numérica estimada ou exata
          "lng": 0.0000, // Longitude numérica estimada ou exata
          "summary": "Distância aprox (ex: 5km) - Tipo terreno (ex: Asfalto)",
          "difficulty": "Iniciante/Intermediário/Avançado"
        }
      ]

      Certifique-se de fornecer coordenadas (lat/lng) numéricas válidas para cada local para que eu possa colocá-los no mapa.
    `;

    const toolConfig: any = {};
    
    // If we have precise geolocation, pass it to the retrieval config for better grounding
    if (location) {
      toolConfig.retrievalConfig = {
        latLng: {
          latitude: location.latitude,
          longitude: location.longitude
        }
      };
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: toolConfig,
        // responseMimeType must NOT be set when using googleMaps
      },
    });

    const text = response.text || "";
    // Access grounding chunks and cast to local type to avoid library version mismatches
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;

    // Try to extract JSON from the text response
    let places: Place[] = [];
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      try {
        // Clean up potential markdown code blocks if included inside the match
        const cleanJson = jsonMatch[0].replace(/```json/g, '').replace(/```/g, '');
        const parsedPlaces = JSON.parse(cleanJson);
        
        // Enrich places with mock leaderboard data
        places = parsedPlaces.map((p: any) => ({
          ...p,
          leaderboard: generateMockLeaderboard()
        }));

      } catch (e) {
        console.warn("Failed to parse places JSON:", e);
      }
    }

    // Return the response data with correctly typed groundingChunks
    return {
      text,
      places,
      groundingChunks
    };

  } catch (error) {
    console.error("Error fetching running routes:", error);
    throw error;
  }
};