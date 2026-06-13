import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocation } from '../../hooks/useLocation';
import { useAuth } from '../../hooks/useAuth';
import { ridersApi, tripsApi } from '../../services/api';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/Card';

interface TripRequest {
  id: string;
  status: string;
  originAddress: string;
  destAddress: string;
  suggestedPrice: number;
  negotiatedPrice?: number;
  currency: string;
  distance?: number;
  client: { id: string; name: string };
}

export default function RiderMapScreen() {
  const { location } = useLocation();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [isAvailable, setIsAvailable] = useState(
    user?.riderProfile?.isAvailable ?? false
  );
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const canGoAvailable = user?.riderProfile?.subscriptionStatus === 'ACTIVE';

  const loadRequests = useCallback(async () => {
    if (!isAvailable) return;
    try {
      const { data } = await tripsApi.list(1);
      const pending = data.data.items.filter((t: { status: string }) => t.status === 'REQUESTED');
      setRequests(pending);
    } catch {
      // ignore
    }
  }, [isAvailable]);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  // Update location when available
  useEffect(() => {
    if (!isAvailable || !location) return;
    ridersApi.updateLocation(location.latitude, location.longitude).catch(() => {});
  }, [location, isAvailable]);

  const handleToggleAvailability = async (value: boolean) => {
    if (value && !canGoAvailable) {
      Alert.alert(
        'Suscripción requerida',
        'Necesitas una suscripción activa para recibir viajes.',
        [{ text: 'OK' }]
      );
      return;
    }
    setToggling(true);
    try {
      await ridersApi.setAvailability(value);
      setIsAvailable(value);
      if (!value) setRequests([]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', axiosErr.response?.data?.error ?? 'No se pudo cambiar disponibilidad');
    } finally {
      setToggling(false);
    }
  };

  const handleAccept = async (tripId: string) => {
    try {
      await tripsApi.accept(tripId);
      router.push('/rider/active-trip');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', axiosErr.response?.data?.error ?? 'No se pudo aceptar el viaje');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const price = (t: TripRequest) => t.negotiatedPrice ?? t.suggestedPrice;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
      >
        <Marker
          coordinate={{ latitude: location.latitude, longitude: location.longitude }}
          title="Tú estás aquí"
        />
      </MapView>

      {/* Availability toggle */}
      <View style={styles.toggleCard}>
        <View style={styles.toggleLeft}>
          <View style={[styles.statusDot, { backgroundColor: isAvailable ? Colors.primary : Colors.textMuted }]} />
          <View>
            <Text style={styles.toggleLabel}>{isAvailable ? 'Disponible' : 'No disponible'}</Text>
            <Text style={styles.toggleSub}>
              {isAvailable ? 'Recibiendo solicitudes' : 'Toca para activarte'}
            </Text>
          </View>
        </View>
        <Switch
          value={isAvailable}
          onValueChange={handleToggleAvailability}
          trackColor={{ false: Colors.border, true: Colors.primaryDark }}
          thumbColor={isAvailable ? Colors.primary : Colors.textSecondary}
          disabled={toggling}
          style={{ transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }] }}
        />
      </View>

      {/* Trip requests */}
      {isAvailable && (
        <View style={styles.requestsContainer}>
          <Text style={styles.requestsTitle}>
            {requests.length > 0 ? `${requests.length} solicitud${requests.length > 1 ? 'es' : ''}` : 'Sin solicitudes'}
          </Text>
          <FlatList
            data={requests}
            keyExtractor={(t) => t.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 8 }}
            renderItem={({ item }) => (
              <Card style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <Text style={styles.clientName}>{item.client.name}</Text>
                  <Text style={styles.requestPrice}>C$ {price(item).toFixed(0)}</Text>
                </View>
                <View style={styles.requestRoute}>
                  <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.routeText} numberOfLines={1}>{item.originAddress}</Text>
                </View>
                <View style={styles.requestRoute}>
                  <View style={[styles.dot, { backgroundColor: Colors.danger }]} />
                  <Text style={styles.routeText} numberOfLines={1}>{item.destAddress}</Text>
                </View>
                {item.distance != null && (
                  <Text style={styles.distance}>{item.distance.toFixed(1)} km</Text>
                )}
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleAccept(item.id)}
                  >
                    <Text style={styles.acceptBtnText}>Aceptar</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )}
            ListEmptyComponent={
              <View style={styles.noRequests}>
                <Text style={styles.noRequestsText}>Esperando solicitudes...</Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  toggleCard: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  toggleLabel: { color: Colors.textPrimary, fontWeight: '600', fontSize: 15 },
  toggleSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  requestsContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
  },
  requestsTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  requestCard: { width: 260, padding: 14 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  clientName: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  requestPrice: { color: Colors.primary, fontWeight: '700', fontSize: 17 },
  requestRoute: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeText: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  distance: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  acceptBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  noRequests: { paddingHorizontal: 20 },
  noRequestsText: { color: Colors.textMuted, fontSize: 13 },
});
