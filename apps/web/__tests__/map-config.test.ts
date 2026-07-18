import { createMapTileConfig, getMapTileUrls, MAP_TILE_CONFIG, MAP_TILE_THEMES } from "@/config/map.config";

describe("Carto Positron map tiles", () => {
  test("uses Carto Positron and the required attribution by default", () => {
    expect(MAP_TILE_CONFIG.url).toContain("basemaps.cartocdn.com/light_all");
    expect(MAP_TILE_CONFIG.attribution).toBe("© OpenStreetMap contributors © CARTO");
    expect(getMapTileUrls()).toHaveLength(4);
    expect(getMapTileUrls()[0]).toContain("https://a.basemaps.cartocdn.com/");
  });

  test("allows a public provider URL override and resolves retina URLs", () => {
    const custom = createMapTileConfig("https://{s}.example.test/{z}/{x}/{y}{r}.png");
    expect(getMapTileUrls(custom, 2)[3]).toBe("https://d.example.test/{z}/{x}/{y}@2x.png");
  });

  test("offers color and dark Carto themes without replacing the configured default", () => {
    expect(MAP_TILE_THEMES.voyager.url).toContain("rastertiles/voyager");
    expect(MAP_TILE_THEMES.dark.url).toContain("dark_all");
  });
});
