import { useEffect, useState } from 'react';
import { subscriptionsApi, ridersApi } from '../../api/endpoints';
import { Badge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { formatCurrency, formatDate } from '../../utils/format';
import type { Subscription, RiderProfile } from '../../types';

export function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [selectedRider, setSelectedRider] = useState('');
  const [months, setMonths] = useState('1');
  const [creating, setCreating] = useState(false);

  const load = async (p: number) => {
    setLoading(true);
    try {
      const { data } = await subscriptionsApi.list(p);
      setSubs(data.data!.items);
      setTotalPages(data.data!.totalPages);
      setTotal(data.data!.total);
      setPage(p);
    } catch {
      setError('Error al cargar suscripciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    ridersApi.list(1, 100).then(({ data }) => setRiders(data.data!.items)).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!selectedRider) return;
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      await subscriptionsApi.create(selectedRider, parseInt(months));
      setSuccess('Suscripción activada correctamente');
      setSelectedRider('');
      await load(page);
    } catch {
      setError('Error al crear suscripción');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Suscripciones</h1>
        <p className="text-gray-400 text-sm mt-1">{total} suscripciones en total</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">{error}</div>
      )}
      {success && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-3 text-emerald-300 text-sm mb-4">{success}</div>
      )}

      {/* Create subscription */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">Activar suscripción manualmente</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Motorista</label>
            <select
              value={selectedRider}
              onChange={(e) => setSelectedRider(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Seleccionar motorista...</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.user.name} — {r.subscriptionStatus}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Meses</label>
            <select
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={!selectedRider || creating}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            {creating ? 'Activando...' : 'Activar suscripción'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Motorista', 'Inicio', 'Vencimiento', 'Monto', 'Estado'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
              ) : subs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No hay suscripciones</td></tr>
              ) : (
                subs.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-white">{s.rider.user.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{formatDate(s.startDate)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{formatDate(s.endDate)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{formatCurrency(s.amount, s.currency)}</td>
                    <td className="px-4 py-3"><Badge status={s.status} /></td>
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
