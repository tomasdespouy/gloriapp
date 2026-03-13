import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY!,
});

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
