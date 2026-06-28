import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import Members from './pages/Members';
import MyProfile from './pages/MyProfile';
import Settings from './pages/Settings';
import AcceptInvite from './pages/AcceptInvite';

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  return session ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <HashRouter>
          <Toaster position="top-center" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="map" element={<MapPage />} />
              <Route path="members" element={<Members />} />
              <Route path="profile" element={<MyProfile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
            </Route>
          </Routes>
        </HashRouter>
      </UIProvider>
    </AuthProvider>
  );
}