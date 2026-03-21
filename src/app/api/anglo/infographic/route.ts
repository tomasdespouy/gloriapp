import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return NextResponse.json({ error: "No prompt" }, { status: 400 });

    const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      config: { responseModalities: ["TEXT", "IMAGE"] },
    });

    // Find image part
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        const buffer = Buffer.from(part.inlineData.data!, "base64");
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": part.inlineData.mimeType,
            "Content-Disposition": "attachment; filename=infografia.png",
          },
        });
      }
    }

    return NextResponse.json({ error: "No image generated" }, { status: 500 });
  } catch (e) {
    console.error("Infographic generation error:", e);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
