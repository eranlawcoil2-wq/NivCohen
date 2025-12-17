import { GoogleGenAI } from "@google/genai";
import { WorkoutType } from '../types';

export const generateWorkoutDescription = async (type: WorkoutType, location: string): Promise<string> => {
  try {
    // API key must be obtained exclusively from process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      כתוב תיאור קצר, אנרגטי ומזמין בעברית לאימון כושר מסוג "${type}" שיתקיים ב"${location}".
      התיאור צריך להיות עד 20 מילים, מלהיב ומושך מתאמנים להירשם. אל תשתמש במרכאות.
    `;
    
    // Updated to gemini-3-flash-preview as recommended for basic text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Use .text property directly as per coding guidelines
    return (response.text || "").trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "אימון חזק ואיכותי שיקח אתכם לקצה!";
  }
};

export const getMotivationQuote = async (): Promise<string> => {
   try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `תן לי משפט מוטיבציה אחד בלבד, קצר וחזק בעברית לספורטאים. לא יותר מ-10 מילים. ללא מרכאות.`;
    
    // Updated to gemini-3-flash-preview as recommended for basic text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Use .text property directly as per coding guidelines
    return (response.text || "").trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "הכאב הוא זמני, הגאווה היא נצחית.";
  }
}