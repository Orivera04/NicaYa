import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { safeRouter } from "../middleware/safe-router.js";

type NominatimItem = { lat: string; lon: string; display_name: string };
const nominatim = "https://nominatim.openstreetmap.org";
const headers = { "User-Agent": "MotoYa-MVP/1.0 (support@motoya.local)", Accept: "application/json" };

async function fromResponse(response: Response) {
  if (!response.ok) throw new Error("GEOCODING_UNAVAILABLE");
  return response.json() as Promise<NominatimItem[]>;
}
const toPlace = (item: NominatimItem) => ({ lat: Number(item.lat), lng: Number(item.lon), address: item.display_name });

export const geocodingRouter = safeRouter();
geocodingRouter.use(authenticate, authorize("CLIENT"));
geocodingRouter.get("/search", async (req, res) => {
  const query = z.string().trim().min(3).max(120).parse(req.query.q);
  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "5", countrycodes: "ni", addressdetails: "1" });
  const results = await fromResponse(await fetch(`${nominatim}/search?${params}`, { headers }));
  res.json(results.map(toPlace));
});
geocodingRouter.get("/reverse", async (req, res) => {
  const lat = z.coerce.number().min(-90).max(90).parse(req.query.lat);
  const lng = z.coerce.number().min(-180).max(180).parse(req.query.lng);
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", zoom: "18" });
  const response = await fetch(`${nominatim}/reverse?${params}`, { headers });
  if (!response.ok) throw new Error("GEOCODING_UNAVAILABLE");
  const item = await response.json() as NominatimItem;
  res.json(toPlace(item));
});
