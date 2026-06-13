import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocation } from '../../hooks/useLocation';
import { useAuth } from '../../hooks/useAuth';
import { tripsApi, ridersApi } from '../../services/api';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NearbyRider {
  id: string;
  userId: string;
  name: string;
  lat: number;
  lng: number;
  avgRating: number;
}

export default function ClientMapScreen() {
  const { location } = useLocation();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [originAddress, setOriginAddress] = useState('Mi ubicación');
  const [destAddress, setDestAddress] = useState('');
  const [destLat, setDestLat] = useState<number | null>(null);
  const [destLng, setDestLng] = useState<number | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [negotiatedPrice, setNegotiatedPrice] = useState('');
  const [nearbyRiders, setNearbyRiders] = useState<NearbyRider[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const mapRef = useRef<MapView>(null);

  const MANAGUA_REGION: Region = {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    if (location) {
      loadNearbyRiders();
    }
  }, [location]);

  const loadNearbyRiders = async () => {
    try {
      const { data } = await ridersApi.nearby(location.latitude, location.longitude);
      setNearbyRiders(data.data.riders);
    } catch {
      // silently fail — map still works
    }
  };

  // Simple price suggestion (mirrors backend formula)
  const calcPrice = (destLatParam: number, destLngParam: number) => {
    const R = 6371;
    const dLat = ((destLatParam - location.latitude) * Math.PI) / 180;
    const dLng = ((destLngParam - location.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((location.latitude * Math.PI) / 180) *
        Math.cos((destLatParam * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(20 + 5 * dist);
  };

  const handleMapPress = (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDestLat(latitude);
    setDestLng(longitude);
    setDestAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    setSuggestedPrice(calcPrice(latitude, longitude));
    setShowPriceModal(true);
  };

  const handleRequestTrip = async () => {
    if (!destLat || !destLng || !destAddress) {
      Alert.alert('Error', 'Toca el mapa para seleccionar tu destino');
      return;
    }
    setLoading(true);
    try {
      await tripsApi.create({
        originLat: location.latitude,
        originLng: location.longitude,
        originAddress,
        destLat,
        destLng,
        destAddress,
        negotiatedPrice: negotiatedPrice ? parseFloat(negotiatedPrice) : undefined,
      });
      setShowPriceModal(false);
      router.push('/client/trip');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', axiosErr.response?.data?.error ?? 'Error al solicitar viaje');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={MANAGUA_REGION}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Nearby rider markers */}
        {nearbyRiders.map((rider) => (
          <Marker
            key={rider.id}
            coordinate={{ latitude: rider.lat, longitude: rider.lng }}
            title={rider.name}
            description={`⭐ ${rider.avgRating.toFixed(1)}`}
          >
            <View style={styles.riderMarker}>
              <Ionicons name="bicycle" size={18} color={Colors.white} />
            </View>
          </Marker>
        ))}

        {/* Destination marker */}
        {destLat && destLng && (
          <Marker
            coordinate={{ latitude: destLat, longitude: destLng }}
            pinColor={Colors.primary}
          />
        )}
      </MapView>

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.addressCard}>
          <View style={styles.addressRow}>
            <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
            <TextInput
              style={styles.addressInput}
              value={originAddress}
              onChangeText={setOriginAddress}
              placeholder="Tu ubicación"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.addressRow}>
            <View style={[styles.dot, { backgroundColor: Colors.danger }]} />
            <TextInput
              style={styles.addressInput}
              value={destAddress}
              onChangeText={setDestAddress}
              placeholder="Toca el mapa o escribe destino"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={styles.menuBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Nearby riders info */}
      {nearbyRiders.length > 0 && (
        <View style={styles.ridersChip}>
          <Ionicons name="bicycle" size={14} color={Colors.primary} />
          <Text style={styles.ridersChipText}>{nearbyRiders.length} moto{nearbyRiders.length !== 1 ? 's' : ''} cerca</Text>
        </View>
      )}

      {/* Price modal */}
      <Modal visible={showPriceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={styles.priceCard}>
            <Text style={styles.priceTitle}>Solicitar viaje</Text>

            <View style={styles.priceRow}>
              <View style={styles.priceDot} />
              <Text style={styles.priceAddr} numberOfLines={1}>{originAddress}</Text>
            </View>
            <View style={styles.priceLine} />
            <View style={styles.priceRow}>
              <View style={[styles.priceDot, { backgroundColor: Colors.danger }]} />
              <Text style={styles.priceAddr} numberOfLines={1}>{destAddress}</Text>
            </View>

            <View style={styles.priceBox}>
              <Text style={styles.priceSuggested}>Precio sugerido</Text>
              <Text style={styles.priceAmount}>C$ {suggestedPrice}</Text>
            </View>

            <Text style={styles.negotiateLabel}>¿Quieres negociar?</Text>
            <TextInput
              style={styles.negotiateInput}
              value={negotiatedPrice}
              onChangeText={setNegotiatedPrice}
              keyboardType="numeric"
              placeholder={`C$ ${suggestedPrice}`}
              placeholderTextColor={Colors.textMuted}
            />

            <Button
              title="Solicitar viaje"
              onPress={handleRequestTrip}
              loading={loading}
              style={{ marginTop: 12 }}
            />
            <Button
              title="Cancelar"
              onPress={() => setShowPriceModal(false)}
              variant="secondary"
              style={{ marginTop: 8 }}
            />
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    zIndex: 10,
  },
  addressCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  addressInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, paddingVertical: 6 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 6, marginLeft: 20 },
  menuBtn: {
    width: 48,
    height: 48,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  riderMarker: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  ridersChip: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ridersChipText: { color: Colors.textSecondary, fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  priceCard: { borderRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24 },
  priceTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  priceDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  priceLine: { width: 1, height: 20, backgroundColor: Colors.border, marginLeft: 4, marginVertical: 2 },
  priceAddr: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  priceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  priceSuggested: { color: Colors.textSecondary, fontSize: 14 },
  priceAmount: { color: Colors.primary, fontSize: 24, fontWeight: '800' },
  negotiateLabel: { color: Colors.textSecondary, fontSize: 14, marginBottom: 8 },
  negotiateInput: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 16,
  },
});
