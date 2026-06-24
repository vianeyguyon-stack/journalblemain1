import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import { I18nProvider } from './i18n/i18nContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthPage } from './components/Auth/AuthPage';
import { Dashboard } from './components/Dashboard/Dashboard';
import { Analytics } from './components/Analytics/Analytics';
import { ProtectedRoute } from './components/ProtectedRoute';
import { JournalAccessGate } from './components/JournalAccessGate';
import { Settings } from './pages/dashboard/Settings';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <I18nProvider>
        <Router>
          <div className="min-h-screen bg-surface-light dark:bg-gray-900">
            <Routes>
              <Route
                path="/"
                element={
                  user ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    <AuthPage onAuthSuccess={() => window.location.reload()} />
                  )
                }
              />
              <Route
                path="/dashboard"
                element={
                  user ? (
                    <ProtectedRoute userId={user.id}>
                      <JournalAccessGate>
                        <Dashboard user={user} />
                      </JournalAccessGate>
                    </ProtectedRoute>
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/analytics"
                element={
                  user ? (
                    <ProtectedRoute userId={user.id}>
                      <JournalAccessGate>
                        <Analytics user={user} />
                      </JournalAccessGate>
                    </ProtectedRoute>
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="/settings"
                element={
                  user ? (
                    <ProtectedRoute userId={user.id}>
                      <JournalAccessGate>
                        <Settings user={user} />
                      </JournalAccessGate>
                    </ProtectedRoute>
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="*"
                element={<Navigate to={user ? "/dashboard" : "/"} replace />}
              />
            </Routes>
            <Toaster position="top-right" />
          </div>
        </Router>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
