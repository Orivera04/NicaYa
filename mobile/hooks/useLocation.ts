import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

// Default: Managua, Nicaragua
const DEFAULT_LOCATION: LocationCoords = { latitude: 12.1364, longitude: -86.2514 };

export function useLocation() {
  const [location, setLocation] = useState<LocationCoords>(DEFAULT_LOCATION);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado. Usando ubicación predeterminada.');
        return;
      }
      setHasPermission(true);
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        setError('No se pudo obtener la ubicación');
      }
    })();
  }, []);

  return { location, hasPermission, error };
}
