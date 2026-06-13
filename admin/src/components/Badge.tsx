import { STATUS_LABELS } from '../utils/format';

interface BadgeProps {
  status: string;
}

const colorMap: Record<string, string> = {
  ACTIVE: 'bg-emerald-900/50 text-emerald-300 border border-emerald-800',
  APPROVED: 'bg-blue-900/50 text-blue-300 border border-blue-800',
  EXPIRED: 'bg-red-900/50 text-red-300 border border-red-800',
  PENDING: 'bg-yellow-900/50 text-yellow-300 border border-yellow-800',
  REJECTED: 'bg-red-900/50 text-red-300 border border-red-800',
  INACTIVE: 'bg-gray-800 text-gray-400 border border-gray-700',
  COMPLETED: 'bg-emerald-900/50 text-emerald-300 border border-emerald-800',
  CANCELLED: 'bg-red-900/50 text-red-300 border border-red-800',
  REQUESTED: 'bg-yellow-900/50 text-yellow-300 border border-yellow-800',
  ACCEPTED: 'bg-blue-900/50 text-blue-300 border border-blue-800',
  EN_ROUTE: 'bg-blue-900/50 text-blue-300 border border-blue-800',
  IN_PROGRESS: 'bg-purple-900/50 text-purple-300 border border-purple-800',
};

export function Badge({ status }: BadgeProps) {
  const classes = colorMap[status] ?? 'bg-gray-800 text-gray-300 border border-gray-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
