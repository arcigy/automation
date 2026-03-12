import { env } from "../../core/env";
import { fetchTool } from "../http/fetch.tool";

export interface GoogleMapsSearchInput {
  query: string;
  type?: string;
  location?: string;
  radius?: number;
}

export interface GooglePlace {
  place_id: string;
  name: string;
  address?: string;
  website?: string;
  phone?: string;
  rating?: number;
  types?: string[];
}

// Global counter for rotation
let keyIndex = 0;

function getNextApiKey(): string {
  const keys = (env.GOOGLE_MAPS_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
  if (keys.length === 0) throw new Error("No GOOGLE_MAPS_API_KEYS found in environment");
  
  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
}

export async function googleMapsSearchTool(input: GoogleMapsSearchInput): Promise<GooglePlace[]> {
  const apiKey = getNextApiKey();
  
  const res = await fetchTool({
    url: "https://places.googleapis.com/v1/places:searchText",
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.websiteUri,places.id,places.formattedAddress",
      "Content-Type": "application/json"
    },
    body: {
      textQuery: input.query,
      languageCode: "sk"
    }
  });

  const rawPlaces = (res.data as any).places || [];
  
  return rawPlaces.map((p: any) => ({
    place_id: p.id,
    name: p.displayName?.text || "Unknown",
    address: p.formattedAddress,
    website: p.websiteUri
  }));
}
