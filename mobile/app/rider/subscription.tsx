import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const profile = user?.riderProfile;

  const subStatus = profile?.subscriptionStatus ?? 'PENDING';
  const expiresAt = profile?.subscriptionExpiresAt;
  const isActive = subStatus === 'ACTIVE';
  const isExpired = subStatus === 'EXPIRED';

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-NI', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Mi suscripción</Text>

        {/* Status card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons
              name={isActive ? 'checkmark-circle' : isExpired ? 'close-circle' : 'time'}
              size={48}
              color={isActive ? Colors.primary : isExpired ? Colors.danger : Colors.warning}
            />
          </View>
          <StatusBadge status={subStatus} />
          <Text style={styles.statusTitle}>
            {isActive ? 'Suscripción activa' : isExpired ? 'Suscripción expirada' : 'Sin suscripción activa'}
          </Text>
          <Text style={styles.statusDesc}>
            {isActive
              ? 'Puedes recibir viajes normalmente.'
              : isExpired
              ? 'Tu suscripción venció. Contáctanos para renovar.'
              : 'Necesitas activar una suscripción para recibir viajes.'}
          </Text>
        </Card>

        {/* Details */}
        <Card>
          <Text style={styles.sectionTitle}>Detalles</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estado del perfil</Text>
            <StatusBadge status={profile?.status ?? 'PENDING'} />
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vencimiento</Text>
            <Text style={styles.detailValue}>{formatDate(expiresAt)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total de viajes</Text>
            <Text style={styles.detailValue}>0</Text>
          </View>
        </Card>

        {/* Pricing info */}
        <Card>
          <Text style={styles.sectionTitle}>Plan mensual</Text>
          <View style={styles.priceBox}>
            <Text style={styles.priceAmount}>C$ 500</Text>
            <Text style={styles.priceUnit}>/ mes</Text>
          </View>
          <Text style={styles.priceDesc}>
            Incluye acceso ilimitado a solicitudes de viaje en todas las ciudades disponibles.
          </Text>
        </Card>

        {/* CTA */}
        {!isActive && (
          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>¿Listo para activar?</Text>
            <Text style={styles.ctaDesc}>
              Contacta al administrador de MotoYa para activar o renovar tu suscripción.
            </Text>
            <Button
              title="Contactar administrador"
              onPress={() => {}}
              style={{ marginTop: 12 }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24, gap: 12 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 8 },
  statusCard: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  statusIcon: { marginBottom: 4 },
  statusTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 4 },
  statusDesc: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 14, textTransform: 'uppercase' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { color: Colors.textSecondary, fontSize: 14 },
  detailValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '500' },
  priceBox: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 8 },
  priceAmount: { color: Colors.primary, fontSize: 36, fontWeight: '800' },
  priceUnit: { color: Colors.textSecondary, fontSize: 16 },
  priceDesc: { color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
  ctaCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginTop: 4,
  },
  ctaTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  ctaDesc: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
