import { useEffect, useState } from 'react';
import { ridersApi } from '../../api/endpoints';
import { Badge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { formatDate } from '../../utils/format';
import type { RiderProfile } from '../../types';

export function RidersPage() {
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await ridersApi.list(p);
      setRiders(data.data!.items);
      setTotalPages(data.data!.totalPages);
      setTotal(data.data!.total);
      setPage(p);
    } catch {
      setError('Error al cargar motoristas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await ridersApi.approve(id);
      await load(page);
    } catch {
      setError('Error al aprobar motorista');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      await ridersApi.setStatus(id, status);
      await load(page);
    } catch {
      setError('Error al cambiar estado');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Motoristas</h1>
        <p className="text-gray-400 text-sm mt-1">{total} motoristas registrados</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Nombre', 'Email', 'Estado perfil', 'Suscripción', 'Rating', 'Viajes', 'Registrado', 'Acciones'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              ) : riders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No hay motoristas
                  </td>
                </tr>
              ) : (
                riders.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-white">{r.user.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{r.user.email}</td>
                    <td className="px-4 py-3"><Badge status={r.status} /></td>
                    <td className="px-4 py-3"><Badge status={r.subscriptionStatus} /></td>
                    <td className="px-4 py-3 text-sm text-gray-300">⭐ {r.avgRating.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{r.totalRides}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatDate(r.user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {r.status === 'PENDING' && (
                          <button
                            onClick={() => handleApprove(r.id)}
                            disabled={actionLoading === r.id}
                            className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            Aprobar
                          </button>
                        )}
                        {r.status === 'APPROVED' && (
                          <button
                            onClick={() => handleSetStatus(r.id, 'INACTIVE')}
                            disabled={actionLoading === r.id}
                            className="text-xs px-2.5 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50"
                          >
                            Desactivar
                          </button>
                        )}
                        {r.status === 'INACTIVE' && (
                          <button
                            onClick={() => handleSetStatus(r.id, 'APPROVED')}
                            disabled={actionLoading === r.id}
                            className="text-xs px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 disabled:opacity-50"
                          >
                            Activar
                          </button>
                        )}
                        {r.status !== 'REJECTED' && r.status !== 'PENDING' && (
                          <button
                            onClick={() => handleSetStatus(r.id, 'REJECTED')}
                            disabled={actionLoading === r.id}
                            className="text-xs px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        )}
                      </div>
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
