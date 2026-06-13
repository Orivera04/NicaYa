import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/login/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { RidersPage } from './pages/riders/RidersPage';
import { ClientsPage } from './pages/clients/ClientsPage';
import { TripsPage } from './pages/trips/TripsPage';
import { ConfigPage } from './pages/config/ConfigPage';
import { SubscriptionsPage } from './pages/subscriptions/SubscriptionsPage';
import type { AuthUser } from './types';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-gray-400">Cargando...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Cargando MotoYa...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage onLogin={(u: AuthUser, at: string, rt: string) => login(u, at, rt)} />
            )
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout onLogout={logout}>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/riders" element={<RidersPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/trips" element={<TripsPage />} />
                  <Route path="/subscriptions" element={<SubscriptionsPage />} />
                  <Route path="/config" element={<ConfigPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
