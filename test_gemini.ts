import { env } from './core/env'; 
import { GoogleGenAI } from '@google/genai'; 
const ai = new GoogleGenAI({apiKey: env.GEMINI_API_KEY}); 

async function main() { 
  try { 
    const r = await ai.models.generateContent({model: 'gemini-2.0-flash', contents: 'Hello'}); 
    console.log('2.0 WORKS:', !!r); 
  } catch(e: any) { 
    console.error('2.0 FAILED:', e.status, e.message); 
  } 
  
  try { 
    const r = await ai.models.generateContent({model: 'gemini-1.5-flash', contents: 'Hello'}); 
    console.log('1.5 WORKS:', !!r); 
  } catch(e: any) { 
    console.error('1.5 FAILED:', e.status, e.message); 
  } 
} 
main();
