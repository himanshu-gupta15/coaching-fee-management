import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { loadSession, sessionExpired } from '@/store/authSlice';
import { setUnauthorizedHandler, tokenStore } from '@/services/api';
import { AdminLayout, PortalLayout } from '@/layouts/AppLayout';
import type { Role } from '@/types';
import LoginPage from '@/pages/auth/LoginPage';

const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const AdminDashboard = lazy(() => import('@/pages/admin/DashboardPage'));
const StudentsPage = lazy(() => import('@/pages/admin/StudentsPage'));
const StudentDetailPage = lazy(() => import('@/pages/admin/StudentDetailPage'));
const ParentsPage = lazy(() => import('@/pages/admin/ParentsPage'));
const FeesPage = lazy(() => import('@/pages/admin/FeesPage'));
const PaymentsPage = lazy(() => import('@/pages/admin/PaymentsPage'));
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage'));
const AdminAnnouncementsPage = lazy(() => import('@/pages/admin/AnnouncementsPage'));
const AuditPage = lazy(() => import('@/pages/admin/AuditPage'));
const ParentHome = lazy(() => import('@/pages/parent/ParentHomePage'));
const ChildPage = lazy(() => import('@/pages/parent/ChildPage'));
const StudentHome = lazy(() => import('@/pages/student/StudentHomePage'));
const MyPaymentsPage = lazy(() => import('@/pages/shared/MyPaymentsPage'));
const NotificationsPage = lazy(() => import('@/pages/shared/NotificationsPage'));
const AnnouncementsFeed = lazy(() => import('@/pages/shared/AnnouncementsFeedPage'));
const AccountPage = lazy(() => import('@/pages/shared/AccountPage'));
const NotFound = lazy(() => import('@/pages/shared/NotFoundPage'));

function FullScreenLoader() {
  return <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, status } = useAppSelector((s) => s.auth);
  const location = useLocation();
  if (status !== 'ready') return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, status } = useAppSelector((s) => s.auth);
  if (status !== 'ready') return <FullScreenLoader />;
  return <Navigate to={user ? `/${user.role}` : '/login'} replace />;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, status } = useAppSelector((s) => s.auth);
  if (status !== 'ready') return <FullScreenLoader />;
  if (user) return <Navigate to={`/${user.role}`} replace />;
  return <>{children}</>;
}

export default function App() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    setUnauthorizedHandler(() => dispatch(sessionExpired()));
    if (tokenStore.get()) void dispatch(loadSession());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
            <Route index element={<AdminDashboard />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="students/:id" element={<StudentDetailPage />} />
            <Route path="parents" element={<ParentsPage />} />
            <Route path="fees" element={<FeesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="announcements" element={<AdminAnnouncementsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="account" element={<AccountPage />} />
          </Route>

          <Route path="/parent" element={<RequireRole role="parent"><PortalLayout role="parent" /></RequireRole>}>
            <Route index element={<ParentHome />} />
            <Route path="children/:id" element={<ChildPage />} />
            <Route path="payments" element={<MyPaymentsPage />} />
            <Route path="announcements" element={<AnnouncementsFeed />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="account" element={<AccountPage />} />
          </Route>

          <Route path="/student" element={<RequireRole role="student"><PortalLayout role="student" /></RequireRole>}>
            <Route index element={<StudentHome />} />
            <Route path="payments" element={<MyPaymentsPage />} />
            <Route path="announcements" element={<AnnouncementsFeed />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="account" element={<AccountPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
