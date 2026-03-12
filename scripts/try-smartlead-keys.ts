import axios from "axios";
import { env } from "../core/env";

const BASE_URL = "https://server.smartlead.ai/api/v1";
const original = env.SMARTLEAD_API_KEY || "";

async function tryKeys() {
  const variations = [
    original.trim(),
    original.split('_')[0].trim(), // Just the UUID part
    original.replace('_', '').trim(), // Remove underscore
  ];

  for (const key of variations) {
    console.log(`Trying key: ${key.substring(0, 10)}... (Length: ${key.length})`);
    try {
      const res = await axios.get(`${BASE_URL}/campaigns`, { params: { api_key: key } });
      console.log(`✅ SUCCESS! Key works. Count: ${res.data.length}`);
      return;
    } catch (e: any) {
      console.log(`❌ FAILED: ${e.response?.data?.message || e.message}`);
    }
  }
}

tryKeys();
