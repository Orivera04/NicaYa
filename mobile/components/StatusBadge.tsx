import { View, Text, StyleSheet } from 'react-native';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: 'Activo', bg: '#064E3B', text: '#34D399' },
  APPROVED: { label: 'Aprobado', bg: '#1E3A5F', text: '#60A5FA' },
  EXPIRED: { label: 'Expirado', bg: '#7F1D1D', text: '#FCA5A5' },
  PENDING: { label: 'Pendiente', bg: '#78350F', text: '#FCD34D' },
  REQUESTED: { label: 'Solicitado', bg: '#78350F', text: '#FCD34D' },
  ACCEPTED: { label: 'Aceptado', bg: '#1E3A5F', text: '#60A5FA' },
  EN_ROUTE: { label: 'En camino', bg: '#1E3A5F', text: '#60A5FA' },
  IN_PROGRESS: { label: 'En progreso', bg: '#312E81', text: '#A78BFA' },
  COMPLETED: { label: 'Completado', bg: '#064E3B', text: '#34D399' },
  CANCELLED: { label: 'Cancelado', bg: '#7F1D1D', text: '#FCA5A5' },
  INACTIVE: { label: 'Inactivo', bg: '#1F2937', text: '#9CA3AF' },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, bg: '#1F2937', text: '#9CA3AF' };
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
