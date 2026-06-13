import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tripsApi } from '../../services/api';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';

interface Trip {
  id: string;
  status: string;
  originAddress: string;
  destAddress: string;
  suggestedPrice: number;
  finalPrice?: number;
  currency: string;
  createdAt: string;
  clientRating?: number;
}

export default function HistoryScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tripsApi.list(1)
      .then(({ data }) => setTrips(data.data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const renderTrip = ({ item }: { item: Trip }) => (
    <Card style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <StatusBadge status={item.status} />
        <Text style={styles.tripDate}>
          {new Date(item.createdAt).toLocaleDateString('es-NI', { month: 'short', day: 'numeric' })}
        </Text>
      </View>
      <Text style={styles.address} numberOfLines={1}>{item.originAddress}</Text>
      <Text style={styles.arrowText}>↓</Text>
      <Text style={styles.address} numberOfLines={1}>{item.destAddress}</Text>
      <View style={styles.footer}>
        <Text style={styles.price}>C$ {(item.finalPrice ?? item.suggestedPrice).toFixed(2)}</Text>
        {item.clientRating != null && (
          <Text style={styles.rating}>{'⭐'.repeat(item.clientRating)}</Text>
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mis viajes</Text>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No tienes viajes aún</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
  list: { padding: 24, gap: 12 },
  tripCard: { gap: 4 },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tripDate: { color: Colors.textMuted, fontSize: 12 },
  address: { color: Colors.textPrimary, fontSize: 14 },
  arrowText: { color: Colors.textMuted, fontSize: 12, marginVertical: 2, marginLeft: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  price: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
  rating: { fontSize: 14 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
