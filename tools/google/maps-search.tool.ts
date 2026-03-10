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
  
  // 1. Search for places
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(input.query)}&key=${apiKey}`;
  const searchRes = await fetchTool({ url: searchUrl });
  
  const results = (searchRes.data as any).results || [];
  const places: GooglePlace[] = [];

  // 2. Get details for each (to get website/phone)
  // Warning: This consumes more quota (1 detail call per place)
  for (const res of results.slice(0, 10)) { // Limit to 10 for safety/speed
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${res.place_id}&fields=name,formatted_address,website,international_phone_number,rating,type&key=${apiKey}`;
    const detailsRes = await fetchTool({ url: detailsUrl });
    const d = (detailsRes.data as any).result;

    if (d) {
      places.push({
        place_id: res.place_id,
        name: d.name,
        address: d.formatted_address,
        website: d.website,
        phone: d.international_phone_number,
        rating: d.rating,
        types: d.types
      });
    }
  }

  return places;
}
