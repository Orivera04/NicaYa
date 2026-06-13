import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { configApi } from '../../api/endpoints';

interface ConfigFormData {
  subscription_price_monthly: string;
  currency: string;
  available_cities: string;
}

export function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const { register, handleSubmit, reset } = useForm<ConfigFormData>();

  useEffect(() => {
    configApi.get().then(({ data }) => {
      const cfg = data.data!.config;
      reset({
        subscription_price_monthly: cfg.subscription_price_monthly ?? '500',
        currency: cfg.currency ?? 'NIO',
        available_cities: cfg.available_cities ?? '[]',
      });
    }).catch(() => setError('Error al cargar configuración'))
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (data: ConfigFormData) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await configApi.update(data);
      setSuccess('Configuración guardada correctamente');
    } catch {
      setError('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-400">Cargando...</div>;
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-gray-400 text-sm mt-1">Parámetros del sistema MotoYa</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">{error}</div>
      )}
      {success && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg p-3 text-emerald-300 text-sm mb-4">{success}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
          <h2 className="text-white font-semibold text-base">Suscripción mensual</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Precio mensual de suscripción
            </label>
            <div className="flex gap-3">
              <input
                {...register('subscription_price_monthly')}
                type="number"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="500"
              />
              <select
                {...register('currency')}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="NIO">C$ (NIO)</option>
                <option value="USD">$ (USD)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
          <h2 className="text-white font-semibold text-base">Ciudades disponibles</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Lista de ciudades (JSON array)
            </label>
            <textarea
              {...register('available_cities')}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
              placeholder='["Managua", "León", "Granada"]'
            />
            <p className="text-gray-500 text-xs mt-1">
              Formato: array JSON con los nombres de las ciudades habilitadas
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
