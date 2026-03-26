import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { AIResponse, ChatMessage } from "../types";
import { Language, languageNames } from "../translations";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

export async function identifyPlant(base64Image: string, language: Language = 'en'): Promise<AIResponse> {
  const model = "gemini-3-flash-preview";
  const langName = languageNames[language] || "English";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            text: `Analyze this plant image. Identify the plant species, detect any diseases, and provide care tips.
            
            CRITICAL: You MUST provide ALL text values in the ${langName} language.
            This includes:
            - plantName
            - healthStatus (must be one of: 'Excellent', 'Good', 'Fair', 'Poor')
            - care.watering
            - care.sunlight
            - care.soil
            - care.fertilizer
            - disease.name (if detected)
            - disease.symptoms (if detected)
            - disease.symptomsList (if detected, as an array of strings)
            - disease.treatment (if detected)
            - disease.treatmentSteps (if detected, as an array of strings)
            - disease.prevention (if detected)
            
            The scientificName should remain in its standard scientific format (usually Latin).
            
            Return the result in JSON format.`,
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          plantName: { type: Type.STRING },
          scientificName: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          healthStatus: { 
            type: Type.STRING,
            description: "High-level health status of the plant",
            enum: ["Excellent", "Good", "Fair", "Poor"]
          },
          care: {
            type: Type.OBJECT,
            properties: {
              watering: { type: Type.STRING },
              sunlight: { type: Type.STRING },
              soil: { type: Type.STRING },
              fertilizer: { type: Type.STRING },
            },
            required: ["watering", "sunlight", "soil", "fertilizer"],
          },
          disease: {
            type: Type.OBJECT,
            properties: {
              detected: { type: Type.BOOLEAN },
              name: { type: Type.STRING },
              symptoms: { type: Type.STRING },
              symptomsList: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              treatment: { type: Type.STRING },
              treatmentSteps: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              prevention: { type: Type.STRING },
            },
            required: ["detected"],
          },
        },
        required: ["plantName", "scientificName", "confidence", "healthStatus", "care", "disease"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as AIResponse;
}

export async function transcribeAudio(base64Audio: string, language: Language = 'en'): Promise<string> {
  const model = "gemini-3-flash-preview";
  const langName = languageNames[language] || "English";

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: `Transcribe the following audio precisely. The expected language is ${langName}. Return ONLY the transcription text.` },
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64Audio.split(",")[1] || base64Audio,
            },
          },
        ],
      },
    ],
  });

  return response.text || "";
}

export async function generateSpeech(text: string, voice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' = 'Kore'): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Failed to generate speech");
  return base64Audio;
}

export async function getChatResponse(
  question: string, 
  history: ChatMessage[] = [], 
  context?: string, 
  language: Language = 'en',
  image?: string
): Promise<string> {
  const model = "gemini-3-flash-preview";
  const langName = languageNames[language] || "English";
  
  const systemInstruction = `You are an expert botanist. Provide concise, helpful, and scientifically accurate advice about plant care, identification, and disease management. ALWAYS respond in ${langName} language. If a question is not about plants, politely redirect the user in ${langName}. ${context ? `Context: This conversation is about a ${context}.` : ""}`;

  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [
      ...(msg.imageUrl ? [{
        inlineData: {
          mimeType: "image/jpeg",
          data: msg.imageUrl.split(",")[1] || msg.imageUrl
        }
      }] : []),
      { text: msg.text }
    ]
  }));

  // Add current message
  const currentParts: any[] = [];
  if (image) {
    currentParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: image.split(",")[1] || image
      }
    });
  }
  currentParts.push({ text: question });

  contents.push({
    role: 'user',
    parts: currentParts
  });

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
    }
  });

  return response.text || "I'm sorry, I couldn't generate an answer. Please try again.";
}
