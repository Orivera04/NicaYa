import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
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
  client: { id: string; name: string; phone?: string };
}

const STATUS_FLOW: Record<string, string> = {
  ACCEPTED: 'EN_ROUTE',
  EN_ROUTE: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

const STATUS_LABELS: Record<string, string> = {
  EN_ROUTE: 'Ir a recoger',
  IN_PROGRESS: 'Iniciar viaje',
  COMPLETED: 'Finalizar viaje',
};

export default function ActiveTripRiderScreen() {
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [ratingModal, setRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingLoading, setRatingLoading] = useState(false);
  const router = useRouter();

  const loadTrip = async () => {
    try {
      const { data } = await tripsApi.list(1);
      const active = data.data.items.find((t: { status: string }) =>
        ['ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'].includes(t.status)
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

  const handleNextStatus = async () => {
    if (!trip) return;
    const nextStatus = STATUS_FLOW[trip.status];
    if (!nextStatus) return;

    setActionLoading(true);
    try {
      await tripsApi.updateStatus(trip.id, nextStatus);
      if (nextStatus === 'COMPLETED') {
        setTrip({ ...trip, status: 'COMPLETED' });
        setRatingModal(true);
      } else {
        await loadTrip();
      }
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRate = async () => {
    if (!trip) return;
    setRatingLoading(true);
    try {
      await tripsApi.rate(trip.id, rating);
      setRatingModal(false);
      setTrip(null);
      router.push('/rider');
    } catch {
      Alert.alert('Error', 'No se pudo enviar la calificación');
    } finally {
      setRatingLoading(false);
    }
  };

  const price = trip ? (trip.negotiatedPrice ?? trip.suggestedPrice) : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!trip || trip.status === 'COMPLETED') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={64} color={Colors.primary} />
          <Text style={styles.emptyText}>No tienes un viaje activo</Text>
          <Button title="Ver solicitudes" onPress={() => router.push('/rider')} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  const nextStatus = STATUS_FLOW[trip.status];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Viaje en curso</Text>

        <Card style={styles.statusCard}>
          <StatusBadge status={trip.status} />
        </Card>

        <Card>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.routeText}>{trip.originAddress}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: Colors.danger }]} />
            <Text style={styles.routeText}>{trip.destAddress}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Tarifa</Text>
            <Text style={styles.priceValue}>C$ {price.toFixed(2)}</Text>
          </View>
        </Card>

        {/* Client info */}
        <Card>
          <Text style={styles.clientLabel}>Cliente</Text>
          <View style={styles.clientRow}>
            <View style={styles.clientAvatar}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientName}>{trip.client.name}</Text>
              {trip.client.phone && (
                <Text style={styles.clientPhone}>{trip.client.phone}</Text>
              )}
            </View>
            {trip.client.phone && (
              <TouchableOpacity style={styles.whatsappBtn}>
                <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Action button */}
        {nextStatus && (
          <Button
            title={STATUS_LABELS[nextStatus] ?? `→ ${nextStatus}`}
            onPress={handleNextStatus}
            loading={actionLoading}
            style={{ marginTop: 8 }}
          />
        )}
      </ScrollView>

      <Modal visible={ratingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>¡Viaje completado!</Text>
            <Text style={styles.ratingSubtitle}>Califica al cliente</Text>
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
              onPress={() => { setRatingModal(false); router.push('/rider'); }}
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
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 1, height: 16, backgroundColor: Colors.border, marginLeft: 4 },
  routeText: { color: Colors.textPrimary, fontSize: 14, flex: 1 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  priceLabel: { color: Colors.textSecondary, fontSize: 14 },
  priceValue: { color: Colors.primary, fontSize: 20, fontWeight: '700' },
  clientLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  clientName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  clientPhone: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  whatsappBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  ratingCard: { gap: 8 },
  ratingTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  ratingSubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 },
});
