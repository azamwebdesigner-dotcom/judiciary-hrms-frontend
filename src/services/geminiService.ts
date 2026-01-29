
import { GoogleGenAI } from "@google/genai";
import { Employee } from "../types";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key is missing.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateEmployeeSummary = async (employee: Employee): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI Service Unavailable: API Key missing.";

  const prompt = `
    Analyze the following employee record for the District Judiciary System of Pakistan and provide a professional career summary (max 150 words).
    Highlight their current designation, years of service, and any major movements (transfers) or leave patterns.

    Employee Data:
    ${JSON.stringify(employee, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating summary. Please check API configuration.";
  }
};
