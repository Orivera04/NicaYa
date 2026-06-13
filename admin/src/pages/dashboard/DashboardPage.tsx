import { useEffect, useState } from 'react';
import { Users, Bike, MapPin, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { dashboardApi } from '../../api/endpoints';
import { MetricCard } from '../../components/MetricCard';
import { formatCurrency } from '../../utils/format';
import type { DashboardMetrics } from '../../types';

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [chartData, setChartData] = useState<{ date: string; viajes: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .get()
      .then(({ data }) => {
        setMetrics(data.data!.metrics);
        const trips = data.data!.charts.tripsPerDay;
        setChartData(
          Object.entries(trips)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({
              date: new Date(date).toLocaleDateString('es-NI', { month: 'short', day: 'numeric' }),
              viajes: count,
            }))
        );
      })
      .catch(() => setError('Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Resumen operacional de MotoYa</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Motoristas activos"
          value={metrics?.activeRiders ?? 0}
          icon={<Bike size={22} />}
          color="emerald"
        />
        <MetricCard
          title="Suscripciones expiradas"
          value={metrics?.expiredSubscriptions ?? 0}
          icon={<AlertTriangle size={22} />}
          color="red"
        />
        <MetricCard
          title="Clientes registrados"
          value={metrics?.totalClients ?? 0}
          icon={<Users size={22} />}
          color="blue"
        />
        <MetricCard
          title="Viajes hoy"
          value={metrics?.tripsToday ?? 0}
          icon={<MapPin size={22} />}
          color="yellow"
        />
        <MetricCard
          title="Viajes completados"
          value={metrics?.completedTrips ?? 0}
          icon={<TrendingUp size={22} />}
          color="emerald"
        />
        <MetricCard
          title="Ingresos por suscripciones"
          value={formatCurrency(metrics?.subscriptionRevenue ?? 0)}
          icon={<CreditCard size={22} />}
          color="purple"
          subtitle="Suscripciones activas"
        />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-white font-semibold mb-4">Viajes por día (últimos 7 días)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Bar dataKey="viajes" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
