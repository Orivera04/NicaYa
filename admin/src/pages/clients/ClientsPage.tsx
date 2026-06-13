import { useEffect, useState } from 'react';
import { clientsApi } from '../../api/endpoints';
import { Pagination } from '../../components/Pagination';
import { formatDate } from '../../utils/format';
import type { User } from '../../types';

export function ClientsPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await clientsApi.list(p);
      setClients(data.data!.items);
      setTotalPages(data.data!.totalPages);
      setTotal(data.data!.total);
      setPage(p);
    } catch {
      setError('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <p className="text-gray-400 text-sm mt-1">{total} clientes registrados</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">{error}</div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Nombre', 'Email', 'Teléfono', 'Registrado'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No hay clientes</td></tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-white">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatDate(c.createdAt)}</td>
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
