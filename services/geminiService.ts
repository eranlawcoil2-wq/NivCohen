import { GoogleGenAI } from "@google/genai";
import { WorkoutType } from '../types';

// Helper to safely get AI instance
const getAiClient = () => {
    // Check if API key exists to prevent crash
    if (!process.env.API_KEY) {
        console.warn("API Key is missing for Gemini");
        return null;
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateWorkoutDescription = async (type: WorkoutType, location: string): Promise<string> => {
  try {
    const ai = getAiClient();
    if (!ai) return "אימון חזק ואיכותי שיקח אתכם לקצה!";

    const prompt = `
      כתוב תיאור קצר, אנרגטי ומזמין בעברית לאימון כושר מסוג "${type}" שיתקיים ב"${location}".
      התיאור צריך להיות עד 20 מילים, מלהיב ומושך מתאמנים להירשם. אל תשתמש במרכאות.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "אימון חזק ואיכותי שיקח אתכם לקצה!";
  }
};

export const getMotivationQuote = async (): Promise<string> => {
   try {
    const ai = getAiClient();
    if (!ai) return "הכאב הוא זמני, הגאווה היא נצחית.";

    const prompt = `תן לי משפט מוטיבציה אחד בלבד, קצר וחזק בעברית לספורטאים. לא יותר מ-10 מילים. ללא מרכאות.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "הכאב הוא זמני, הגאווה היא נצחית.";
  }
}