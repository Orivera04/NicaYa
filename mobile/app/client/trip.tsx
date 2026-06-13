import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { tripsApi } from '../../services/api';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';

interface ActiveTrip {
  id: string;
  status: string;
  originAddress: string;
  destAddress: string;
  suggestedPrice: number;
  negotiatedPrice?: number;
  currency: string;
  rider?: { id: string; name: string; phone?: string };
}

export default function ActiveTripScreen() {
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingModal, setRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingLoading, setRatingLoading] = useState(false);
  const router = useRouter();

  const loadTrip = async () => {
    try {
      const { data } = await tripsApi.list(1);
      const active = data.data.items.find((t: { status: string }) =>
        ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'].includes(t.status)
      );
      setTrip(active ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrip();
    const interval = setInterval(loadTrip, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (trip?.status === 'COMPLETED') {
      setRatingModal(true);
    }
  }, [trip?.status]);

  const handleCancel = async () => {
    if (!trip) return;
    Alert.alert('Cancelar viaje', '¿Estás seguro de cancelar?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await tripsApi.updateStatus(trip.id, 'CANCELLED');
            setTrip(null);
          } catch {
            Alert.alert('Error', 'No se pudo cancelar el viaje');
          }
        },
      },
    ]);
  };

  const handleRate = async () => {
    if (!trip) return;
    setRatingLoading(true);
    try {
      await tripsApi.rate(trip.id, rating);
      setRatingModal(false);
      setTrip(null);
    } catch {
      Alert.alert('Error', 'No se pudo enviar la calificación');
    } finally {
      setRatingLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Ionicons name="car-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No tienes un viaje activo</Text>
          <Button
            title="Solicitar viaje"
            onPress={() => router.push('/client')}
            style={{ marginTop: 20, paddingHorizontal: 32 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const price = trip.negotiatedPrice ?? trip.suggestedPrice;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Viaje activo</Text>

        <Card style={styles.statusCard}>
          <StatusBadge status={trip.status} />
          <Text style={styles.statusDesc}>
            {trip.status === 'REQUESTED' && 'Buscando motorista disponible...'}
            {trip.status === 'ACCEPTED' && 'El motorista ha aceptado tu viaje'}
            {trip.status === 'EN_ROUTE' && 'El motorista está en camino'}
            {trip.status === 'IN_PROGRESS' && 'Estás en tu viaje'}
          </Text>
        </Card>

        {/* Route */}
        <Card style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.routeText}>{trip.originAddress}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: Colors.danger }]} />
            <Text style={styles.routeText}>{trip.destAddress}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Precio</Text>
            <Text style={styles.priceValue}>C$ {price.toFixed(2)}</Text>
          </View>
        </Card>

        {/* Rider info */}
        {trip.rider && (
          <Card style={styles.riderCard}>
            <Text style={styles.riderTitle}>Tu motorista</Text>
            <View style={styles.riderInfo}>
              <View style={styles.riderAvatar}>
                <Ionicons name="person" size={28} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.riderName}>{trip.rider.name}</Text>
                {trip.rider.phone && (
                  <Text style={styles.riderPhone}>{trip.rider.phone}</Text>
                )}
              </View>
              {trip.rider.phone && (
                <TouchableOpacity style={styles.whatsappBtn}>
                  <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                </TouchableOpacity>
              )}
            </View>
          </Card>
        )}

        {/* Cancel (only before in progress) */}
        {['REQUESTED', 'ACCEPTED'].includes(trip.status) && (
          <Button
            title="Cancelar viaje"
            onPress={handleCancel}
            variant="danger"
            style={{ marginTop: 8 }}
          />
        )}
      </ScrollView>

      {/* Rating modal */}
      <Modal visible={ratingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>¡Viaje completado!</Text>
            <Text style={styles.ratingSubtitle}>Califica a tu motorista</Text>

            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setRating(s)}>
                  <Ionicons
                    name={s <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={s <= rating ? '#F59E0B' : Colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Button title="Enviar calificación" onPress={handleRate} loading={ratingLoading} />
            <Button
              title="Omitir"
              onPress={() => { setRatingModal(false); setTrip(null); }}
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
  content: { padding: 24, gap: 12 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: Colors.textSecondary, fontSize: 16 },
  statusCard: { gap: 8 },
  statusDesc: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  routeCard: { gap: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 1, height: 16, backgroundColor: Colors.border, marginLeft: 4 },
  routeText: { color: Colors.textPrimary, fontSize: 14, flex: 1 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  priceLabel: { color: Colors.textSecondary, fontSize: 14 },
  priceValue: { color: Colors.primary, fontSize: 20, fontWeight: '700' },
  riderCard: {},
  riderTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  riderInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  riderPhone: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  whatsappBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  ratingCard: { gap: 8 },
  ratingTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  ratingSubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 },
});
