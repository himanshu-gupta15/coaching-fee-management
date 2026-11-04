import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BookOpen, ChevronRight, ChevronsUpDown, CreditCard, FileBarChart, GraduationCap, Home, LayoutGrid,
  LogOut, Megaphone, Menu, PanelLeftClose, PanelLeftOpen, Plus, Receipt, ScrollText, Search, Settings, UserRound, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/authSlice';
import { fetchUnread, setMobileNav } from '@/store/uiSlice';
import { Sheet } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, Logo } from '@/components/common';
import { StudentFormDialog } from '@/features/students/StudentFormDialog';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

const INSTITUTE = 'BrightPath Academy';
interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: 'unread' }

const ADMIN_MAIN: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/fees', label: 'Fee Management', icon: Wallet },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell, badge: 'unread' },
];
const ADMIN_WORKSPACE: NavItem[] = [
  { to: '/admin/parents', label: 'Parents', icon: Users },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { to: '/admin/account', label: 'Settings', icon: Settings },
];

export const NAV: Record<'parent' | 'student', NavItem[]> = {
  parent: [
    { to: '/parent', label: 'Home', icon: Home, end: true },
    { to: '/parent/payments', label: 'Payments', icon: Receipt },
    { to: '/parent/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/parent/notifications', label: 'Notifications', icon: Bell, badge: 'unread' },
  ],
  student: [
    { to: '/student', label: 'My fees', icon: Home, end: true },
    { to: '/student/payments', label: 'Payments', icon: Receipt },
    { to: '/student/announcements', label: 'Announcements', icon: BookOpen },
    { to: '/student/notifications', label: 'Notifications', icon: Bell, badge: 'unread' },
  ],
};
const MOBILE_LABEL: Record<string, string> = { Announcements: 'Notices', Notifications: 'Alerts' };

const PAGE_NAMES: [RegExp, string][] = [
  [/^\/admin\/?$/, 'Overview'], [/^\/admin\/students\/.+/, 'Student profile'], [/^\/admin\/students/, 'Students'], [/^\/admin\/fees/, 'Fee Management'],
  [/^\/admin\/payments/, 'Payments'], [/^\/admin\/reports/, 'Reports'], [/^\/admin\/notifications/, 'Notifications'], [/^\/admin\/parents/, 'Parents'],
  [/^\/admin\/announcements/, 'Announcements'], [/^\/admin\/audit/, 'Audit log'], [/^\/admin\/account/, 'Settings'],
];

function readCollapsed() { try { return localStorage.getItem('cfm.sidebar') === 'collapsed'; } catch { return false; } }

function useUnreadPolling() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  useEffect(() => { void dispatch(fetchUnread()); }, [dispatch, location.pathname]);
  useEffect(() => {
    const t = setInterval(() => void dispatch(fetchUnread()), 60_000);
    return () => clearInterval(t);
  }, [dispatch]);
}

function CountBadge({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return <span className={cn('flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white', className)}>{n > 9 ? '9+' : n}</span>;
}

function SideLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const unread = useAppSelector((s) => s.ui.unread);
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} title={collapsed ? item.label : undefined}
      className={({ isActive }) => cn('relative flex items-center gap-3 rounded-lg border px-3 py-[7px] text-sm font-medium transition-colors',
        collapsed && 'justify-center px-0',
        isActive ? 'border-border bg-white text-foreground shadow-[var(--shadow-pill)]' : 'border-transparent text-slate-600 hover:bg-muted hover:text-foreground')}>
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {item.badge && (collapsed ? (unread > 0 && <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-primary" />) : <CountBadge n={unread} />)}
    </NavLink>
  );
}

function UserMenu({ variant }: { variant: 'sidebar' | 'top' }) {
  const user = useAppSelector((s) => s.auth.user)!;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const base = `/${user.role}`;
  const roleLabel = user.role === 'admin' ? 'Admin · Full Access' : user.role === 'parent' ? 'Parent' : 'Student';
  return (
    <DropdownMenu>
      {variant === 'sidebar' ? (
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-muted" aria-label="Account menu">
          <Avatar name={user.name} className="h-8 w-8" />
          <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm font-medium">{user.name}</span><span className="block truncate text-[11px] text-muted-foreground">{roleLabel}</span></span>
          <ChevronsUpDown className="h-4 w-4 text-slate-400" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-1.5 hover:bg-muted" aria-label="Account menu">
          <Avatar name={user.name} className="h-8 w-8" />
          <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground sm:block">{user.name.split(' ')[0]}</span>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={variant === 'sidebar' ? 'start' : 'end'} side={variant === 'sidebar' ? 'top' : 'bottom'}>
        <DropdownMenuLabel>
          <p className="text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate font-normal">{user.email}</p>
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
    <Link to={`/${role}/notifications`} className="relative rounded-lg p-2 text-slate-500 hover:bg-muted hover:text-foreground" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
      <Bell className="h-[18px] w-[18px]" />
      <CountBadge n={unread} className="absolute -right-0.5 -top-0.5" />
    </Link>
  );
}

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Main">
      {ADMIN_MAIN.map((n) => <SideLink key={n.to} item={n} collapsed={collapsed} onNavigate={onNavigate} />)}
      {collapsed ? <div className="mx-2 my-3 h-px bg-border" /> : <p className="px-3 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Workspace</p>}
      {ADMIN_WORKSPACE.map((n) => <SideLink key={n.to} item={n} collapsed={collapsed} onNavigate={onNavigate} />)}
    </nav>
  );
}

function TopSearch() {
  const navigate = useNavigate();
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <form role="search" className="relative hidden w-full max-w-xs md:block" onSubmit={(e) => {
      e.preventDefault();
      navigate(`/admin/students${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ''}`, { state: { search: q.trim() } });
      ref.current?.blur();
    }}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students by name or ID" aria-label="Search students"
        className="h-9 w-full rounded-lg border border-transparent bg-muted pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-input focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring/30" />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-white px-1.5 text-[11px] text-slate-400">/</kbd>
    </form>
  );
}

export function AdminLayout() {
  const open = useAppSelector((s) => s.ui.mobileNavOpen);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [addOpen, setAddOpen] = useState(false);
  useUnreadPolling();
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem('cfm.sidebar', c ? 'open' : 'collapsed'); } catch { /* ignore */ } return !c; });
  const page = PAGE_NAMES.find(([rx]) => rx.test(location.pathname))?.[1] ?? '';

  return (
    <div className="min-h-dvh">
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar transition-[width] lg:flex', collapsed ? 'w-[68px]' : 'w-60')}>
        <div className={cn('flex h-16 items-center', collapsed ? 'justify-center' : 'px-4')}><Logo subtitle={INSTITUTE} compact={collapsed} /></div>
        <div className="flex-1 overflow-y-auto pt-1"><SidebarBody collapsed={collapsed} /></div>
        <div className="border-t p-3">
          <button onClick={toggle} className={cn('mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-muted', collapsed && 'justify-center px-0')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" />Collapse</>}
          </button>
          {collapsed ? <div className="flex justify-center"><UserMenu variant="top" /></div> : <UserMenu variant="sidebar" />}
        </div>
      </aside>
      <Sheet open={open} onOpenChange={(o) => dispatch(setMobileNav(o))} title="Navigation">
        <div className="flex h-full flex-col bg-white">
          <div className="flex h-16 items-center px-4"><Logo subtitle={INSTITUTE} /></div>
          <div className="flex-1 overflow-y-auto"><SidebarBody collapsed={false} onNavigate={() => dispatch(setMobileNav(false))} /></div>
          <div className="border-t p-3"><UserMenu variant="sidebar" /></div>
        </div>
      </Sheet>
      <div className={cn('transition-[padding]', collapsed ? 'lg:pl-[68px]' : 'lg:pl-60')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-muted lg:hidden" onClick={() => dispatch(setMobileNav(true))} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden"><Logo compact /></div>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
            <Link to="/admin" className="truncate text-muted-foreground hover:text-foreground">{INSTITUTE}</Link>
            {page && <><ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate font-medium text-foreground">{page}</span></>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <TopSearch />
            <Button variant="dark" onClick={() => setAddOpen(true)} className="hidden sm:inline-flex"><Plus />Add student</Button>
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <BellButton />
            <UserMenu variant="top" />
          </div>
        </header>
        <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8 sm:py-8 animate-in"><Outlet /></main>
      </div>
      <StudentFormDialog open={addOpen} onOpenChange={setAddOpen} onSaved={(s) => navigate(`/admin/students/${s._id}`)} />
    </div>
  );
}

/** Parent & student portal: top tabs on desktop, bottom tab bar on mobile. */
export function PortalLayout({ role }: { role: 'parent' | 'student' }) {
  useUnreadPolling();
  const unread = useAppSelector((s) => s.ui.unread);
  const items = NAV[role];
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1000px] items-center gap-6 px-4 sm:px-6">
          <Logo subtitle={`${INSTITUTE} · ${role === 'parent' ? 'Parent' : 'Student'} portal`} />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-muted text-foreground' : 'text-slate-600 hover:bg-muted/70 hover:text-foreground')}>
                {n.label}{n.badge && <CountBadge n={unread} />}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1"><BellButton /><UserMenu variant="top" /></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6 sm:py-10 animate-in"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 pb-safe backdrop-blur md:hidden" aria-label="Main">
        <div className="grid grid-cols-4">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cn('relative flex flex-col items-center gap-0.5 pt-2 text-[11px] font-medium', isActive ? 'text-primary' : 'text-slate-500')}>
              <n.icon className="h-5 w-5" />
              {MOBILE_LABEL[n.label] ?? n.label}
              {n.badge && unread > 0 && <span className="absolute right-[calc(50%-16px)] top-1.5 h-2 w-2 rounded-full bg-primary" />}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export type { Role };
