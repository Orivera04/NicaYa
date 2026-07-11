import { haversineKm } from "../src/lib/geo";
test("calcula una distancia Haversine",()=>expect(haversineKm({lat:12.1364,lng:-86.2514},{lat:12.115,lng:-86.236})).toBeGreaterThan(2));
