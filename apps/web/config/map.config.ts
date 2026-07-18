const defaultTileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export type MapTileConfig = {
  url: string;
  subdomains: readonly ["a", "b", "c", "d"];
  attribution: string;
  maxZoom: number;
};

export const createMapTileConfig = (url = process.env.NEXT_PUBLIC_MAP_TILE_URL || defaultTileUrl): MapTileConfig => ({
  url,
  subdomains: ["a", "b", "c", "d"],
  attribution: "© OpenStreetMap contributors © CARTO",
  maxZoom: 20,
});

export const MAP_TILE_CONFIG = createMapTileConfig();

/** MapLibre receives an array of concrete URLs instead of Leaflet's `{s}` template. */
export const getMapTileUrls = (config = MAP_TILE_CONFIG, devicePixelRatio = 1) => {
  const retinaSuffix = devicePixelRatio > 1 ? "@2x" : "";
  return config.subdomains.map((subdomain) => config.url.replace("{s}", subdomain).replace("{r}", retinaSuffix));
};
