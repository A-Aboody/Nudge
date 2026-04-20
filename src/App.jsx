import { Route, Routes, Navigate } from 'react-router-dom';
import NadinePage from './pages/NadinePage/NadinePage'; // TEMPORARY
import HomePage from './pages/HomePage/HomePage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import NotesPage from './pages/NotesPage/NotesPage';
import AddBillPage from './pages/AddBillPage/AddBillPage';
import CalendarPage from './pages/CalendarPage/CalenderPage';
import ToDoPage from './pages/ToDoPage/ToDoPage';
import SpotifyCallbackPage from './pages/SpotifyCallbackPage/SpotifyCallbackPage';
import LoginPage from './pages/LoginPage/LoginPage';
import PageLayout from './layouts/PageLayout/PageLayout';
import { NavbarProvider } from './context/NavbarContext';
import { SpotifyProvider } from './context/SpotifyContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Flex, Spinner } from '@chakra-ui/react';

// ── TEMPORARY: set to false to restore normal app ────────────────────────────
const NADINE_MODE = true;
// ─────────────────────────────────────────────────────────────────────────────

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="lg" color="primary" />
      </Flex>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="lg" color="primary" />
      </Flex>
    );
  }

  // If not logged in, show login page for all routes except /callback
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/callback" element={<SpotifyCallbackPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <NavbarProvider>
      <SpotifyProvider>
        <PageLayout>
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='/settings' element={<SettingsPage />} />
            <Route path='/notes' element={<NotesPage />} />
            <Route path='/calendar' element={<CalendarPage />} />
            <Route path='/add-bill' element={<AddBillPage />} />
            <Route path='/todo' element={<ToDoPage />} />
            <Route path='/callback' element={<SpotifyCallbackPage />} />
            <Route path='/login' element={<Navigate to="/" replace />} />
          </Routes>
        </PageLayout>
      </SpotifyProvider>
    </NavbarProvider>
  );
}

function App() {
  if (NADINE_MODE) return <NadinePage />;
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
