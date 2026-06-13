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
  finalPrice?: number;
  suggestedPrice: number;
  currency: string;
  createdAt: string;
  riderRating?: number;
  client: { name: string };
}

export default function RiderHistoryScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tripsApi.list(1)
      .then(({ data }) => setTrips(data.data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mis viajes</Text>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 24, gap: 12 }}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.header}>
                <StatusBadge status={item.status} />
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleDateString('es-NI', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text style={styles.client}>{item.client?.name ?? '—'}</Text>
              <Text style={styles.address} numberOfLines={1}>{item.originAddress} → {item.destAddress}</Text>
              <View style={styles.footer}>
                <Text style={styles.price}>C$ {(item.finalPrice ?? item.suggestedPrice).toFixed(2)}</Text>
                {item.riderRating != null && <Text>{'⭐'.repeat(item.riderRating)}</Text>}
              </View>
            </Card>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No tienes viajes aún</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  date: { color: Colors.textMuted, fontSize: 12 },
  client: { color: Colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  address: { color: Colors.textSecondary, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  price: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
