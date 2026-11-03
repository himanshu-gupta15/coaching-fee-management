import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BookOpen, ChevronDown, CreditCard, FileBarChart, GraduationCap, Home, LayoutDashboard,
  LogOut, Megaphone, Menu, Receipt, ScrollText, Users, UserRound, Wallet, type LucideIcon,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/authSlice';
import { fetchUnread, setMobileNav } from '@/store/uiSlice';
import { Sheet } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; mobile?: boolean }

export const NAV: Record<Role, NavItem[]> = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/students', label: 'Students', icon: GraduationCap },
    { to: '/admin/parents', label: 'Parents', icon: Users },
    { to: '/admin/fees', label: 'Fees', icon: Wallet },
    { to: '/admin/payments', label: 'Payments', icon: CreditCard },
    { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
    { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
  ],
  parent: [
    { to: '/parent', label: 'Home', icon: Home, end: true, mobile: true },
    { to: '/parent/payments', label: 'Payments', icon: Receipt, mobile: true },
    { to: '/parent/announcements', label: 'Notices', icon: Megaphone, mobile: true },
    { to: '/parent/notifications', label: 'Alerts', icon: Bell, mobile: true },
  ],
  student: [
    { to: '/student', label: 'My fees', icon: Home, end: true, mobile: true },
    { to: '/student/payments', label: 'Payments', icon: Receipt, mobile: true },
    { to: '/student/announcements', label: 'Notices', icon: BookOpen, mobile: true },
    { to: '/student/notifications', label: 'Alerts', icon: Bell, mobile: true },
  ],
};

function Brand({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-sm">
        <svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M9 21.5 16 9l7 12.5h-4.2L16 16.2l-2.8 5.3Z" fill="#fff" /></svg>
      </div>
      <div className="leading-tight">
        <p className={cn('text-sm font-semibold', dark ? 'text-white' : 'text-slate-900')}>BrightPath</p>
        <p className={cn('text-[11px]', dark ? 'text-slate-400' : 'text-slate-500')}>Fee Management</p>
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Main">
      {NAV.admin.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate}
          className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')}>
          <n.icon className="h-4 w-4" />{n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserMenu() {
  const user = useAppSelector((s) => s.auth.user)!;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const base = `/${user.role}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100" aria-label="Account menu">
        <Avatar name={user.name} className="h-8 w-8" />
        <span className="hidden max-w-[140px] truncate text-sm font-medium text-slate-700 md:block">{user.name}</span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <p className="text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate font-normal">{user.email}</p>
          <p className="mt-1 capitalize text-primary">{user.role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(`${base}/account`)}><UserRound />Account &amp; password</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(`${base}/notifications`)}><Bell />Notifications</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={async () => { await dispatch(logout()); navigate('/login'); }}><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BellButton() {
  const unread = useAppSelector((s) => s.ui.unread);
  const role = useAppSelector((s) => s.auth.user!.role);
  return (
    <Link to={`/${role}/notifications`} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
      <Bell className="h-5 w-5" />
      {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  );
}

function useUnreadPolling() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  useEffect(() => { void dispatch(fetchUnread()); }, [dispatch, location.pathname]);
  useEffect(() => {
    const t = setInterval(() => void dispatch(fetchUnread()), 60_000);
    return () => clearInterval(t);
  }, [dispatch]);
}

export function AdminLayout() {
  const open = useAppSelector((s) => s.ui.mobileNavOpen);
  const dispatch = useAppDispatch();
  useUnreadPolling();
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5"><Brand dark /></div>
        <SidebarNav />
        <div className="mt-auto p-4">
          <div className="rounded-lg bg-white/5 p-3 text-xs text-slate-400">
            <p className="font-medium text-slate-200">BrightPath Academy</p>
            <p className="mt-0.5">Admin console</p>
          </div>
        </div>
      </aside>
      <Sheet open={open} onOpenChange={(o) => dispatch(setMobileNav(o))} title="Navigation">
        <div className="flex h-16 items-center px-5"><Brand dark /></div>
        <SidebarNav onNavigate={() => dispatch(setMobileNav(false))} />
      </Sheet>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-white/85 px-4 backdrop-blur sm:h-16 sm:px-6">
          <button className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => dispatch(setMobileNav(true))} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden"><Brand /></div>
          <div className="ml-auto flex items-center gap-1"><BellButton /><UserMenu /></div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 animate-in"><Outlet /></main>
      </div>
    </div>
  );
}

/** Parent & student portal: simple top nav on desktop, bottom tab bar on mobile. */
export function PortalLayout({ role }: { role: 'parent' | 'student' }) {
  useUnreadPolling();
  const unread = useAppSelector((s) => s.ui.unread);
  const items = NAV[role];
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className={cn('sticky top-0 z-20 border-b bg-white/90 backdrop-blur transition-shadow', scrolled && 'shadow-sm')}>
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:h-16 sm:px-6">
          <Brand />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-primary-soft text-primary' : 'text-slate-600 hover:bg-slate-100')}>
                {n.label === 'Notices' ? 'Announcements' : n.label === 'Alerts' ? 'Notifications' : n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1"><BellButton /><UserMenu /></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 animate-in"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 pb-safe backdrop-blur md:hidden" aria-label="Main">
        <div className="grid grid-cols-4">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cn('relative flex flex-col items-center gap-0.5 pt-2 text-[11px] font-medium', isActive ? 'text-primary' : 'text-slate-500')}>
              <n.icon className="h-5 w-5" />
              {n.label}
              {n.label === 'Alerts' && unread > 0 && <span className="absolute right-[calc(50%-18px)] top-1.5 h-2 w-2 rounded-full bg-red-500" />}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

