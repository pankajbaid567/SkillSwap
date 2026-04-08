import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import { ROUTES } from './constants/routes';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import Matches from './pages/Matches';
import Profile from './pages/Profile';
import Register from './pages/Register';
import SwapDetail from './pages/SwapDetail';

const App = () => (
  <Routes>
    <Route path={ROUTES.login} element={<Login />} />
    <Route path={ROUTES.register} element={<Register />} />
    <Route path={ROUTES.forgotPassword} element={<ForgotPassword />} />

    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path={ROUTES.dashboard} element={<Dashboard />} />
        <Route path={ROUTES.matches} element={<Matches />} />
        <Route path={ROUTES.swapDetail()} element={<SwapDetail />} />
        <Route path={ROUTES.profile} element={<Profile />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
  </Routes>
);

export default App;
