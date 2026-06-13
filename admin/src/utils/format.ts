export function formatCurrency(amount: number, currency = 'NIO'): string {
  return `${currency === 'NIO' ? 'C$' : '$'}${amount.toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-NI', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-NI', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Solicitado',
  ACCEPTED: 'Aceptado',
  EN_ROUTE: 'En camino',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  EXPIRED: 'Expirado',
};
