import { useEffect, useState } from 'react';
import { tripsApi } from '../../api/endpoints';
import { Badge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { formatCurrency, formatDateTime } from '../../utils/format';
import type { Trip } from '../../types';

export function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);

  const load = async (p: number) => {
    setLoading(true);
    try {
      const { data } = await tripsApi.list(p);
      setTrips(data.data!.items);
      setTotalPages(data.data!.totalPages);
      setTotal(data.data!.total);
      setPage(p);
    } catch {
      setError('Error al cargar viajes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const handleCancel = async (id: string) => {
    setCancelLoading(id);
    try {
      await tripsApi.cancel(id);
      await load(page);
    } catch {
      setError('Error al cancelar viaje');
    } finally {
      setCancelLoading(null);
    }
  };

  const canCancel = (status: Trip['status']) =>
    ['REQUESTED', 'ACCEPTED', 'EN_ROUTE'].includes(status);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Viajes</h1>
        <p className="text-gray-400 text-sm mt-1">{total} viajes en total</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">{error}</div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Cliente', 'Motorista', 'Origen', 'Destino', 'Precio', 'Estado', 'Fecha', 'Acción'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
              ) : trips.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No hay viajes</td></tr>
              ) : (
                trips.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-white">{t.client.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{t.rider?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-32 truncate">{t.originAddress}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-32 truncate">{t.destAddress}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {formatCurrency(t.finalPrice ?? t.negotiatedPrice ?? t.suggestedPrice, t.currency)}
                    </td>
                    <td className="px-4 py-3"><Badge status={t.status} /></td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatDateTime(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      {canCancel(t.status) && (
                        <button
                          onClick={() => handleCancel(t.id)}
                          disabled={cancelLoading === t.id}
                          className="text-xs px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-800">
          <Pagination page={page} totalPages={totalPages} onPageChange={load} />
        </div>
      </div>
    </div>
  );
}
