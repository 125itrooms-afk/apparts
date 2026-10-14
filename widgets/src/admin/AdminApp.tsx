import {
  BarChart3,
  Bell,
  FlaskConical,
  LayoutDashboard,
  LayoutGrid,
  MessagesSquare,
  Plug,
  Settings2,
  Split,
  Inbox,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { checkSla } from '../core/leads';
import { set, useApp } from '../core/store';
import type { Role } from '../core/types';
import { cx, fmtTime, safeStorage } from '../core/util';
import { Demo } from '../ui/kit';
import { Dashboard } from './Dashboard';
import { WidgetsPage } from './WidgetsPage';
import { LeadsPage } from './LeadsPage';
import { ChatsPage } from './ChatsPage';
import { ScenariosPage } from './ScenariosPage';
import { ABPage } from './ABPage';
import { AnalyticsPage } from './AnalyticsPage';
import { IntegrationsPage } from './IntegrationsPage';
import { StaffPage } from './StaffPage';
import { SettingsPage } from './SettingsPage';

export type Section = 'home' | 'widgets' | 'leads' | 'chats' | 'scenarios' | 'ab' | 'analytics' | 'integrations' | 'staff' | 'settings';

export const NAV: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'home', label: 'Главная', icon: LayoutDashboard },
  { id: 'widgets', label: 'Виджеты', icon: LayoutGrid },
  { id: 'leads', label: 'Заявки', icon: Inbox },
  { id: 'chats', label: 'Чаты', icon: MessagesSquare },
  { id: 'scenarios', label: 'Сценарии', icon: Split },
  { id: 'ab', label: 'A/B-тесты', icon: FlaskConical },
  { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
  { id: 'integrations', label: 'Интеграции', icon: Plug },
  { id: 'staff', label: 'Сотрудники', icon: Users },
  { id: 'settings', label: 'Настройки', icon: Settings2 },
];

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Руководитель',
  marketer: 'Маркетолог',
  manager: 'Менеджер бронирования',
  admin: 'Администратор системы',
};

/** Матрица прав: что роль видит и что может менять. В проде проверяется на сервере (RBAC в API). */
export const PERMS: Record<Role, { view: Section[]; edit: Section[] }> = {
  owner: { view: NAV.map((n) => n.id), edit: ['leads', 'chats', 'staff', 'settings', 'widgets', 'scenarios', 'ab'] },
  marketer: { view: ['home', 'widgets', 'leads', 'chats', 'scenarios', 'ab', 'analytics', 'integrations', 'settings'], edit: ['widgets', 'scenarios', 'ab', 'settings'] },
  manager: { view: ['home', 'leads', 'chats'], edit: ['leads', 'chats'] },
  admin: { view: ['home', 'integrations', 'staff', 'settings', 'widgets'], edit: ['integrations', 'staff', 'settings'] },
};

export function useCan(section: Section) {
  const role = useApp((s) => s.role);
  return PERMS[role].edit.includes(section);
}

export function AdminApp() {
  const role = useApp((s) => s.role);
  const [section, setSection] = useState<Section>(() => safeStorage.get('v125-admin-section', 'home'));
  const allowed = PERMS[role].view;
  const current = allowed.includes(section) ? section : 'home';
  const unreadChats = useApp((s) => s.chats.filter((c) => c.unreadForManager > 0 || c.mode === 'waiting_manager').length);
  const newLeads = useApp((s) => s.leads.filter((l) => l.status === 'new').length);

  useEffect(() => safeStorage.set('v125-admin-section', current), [current]);
  useEffect(() => {
    checkSla();
    const t = window.setInterval(checkSla, 15000);
    return () => clearInterval(t);
  }, []);

  const go = (s: Section) => setSection(s);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto rounded-2xl border border-paper-line bg-white p-2 lg:w-56 lg:flex-col lg:self-start" aria-label="Разделы панели">
        {NAV.filter((n) => allowed.includes(n.id)).map((n) => {
          const badge = n.id === 'leads' ? newLeads : n.id === 'chats' ? unreadChats : 0;
          return (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              aria-current={current === n.id ? 'page' : undefined}
              className={cx(
                'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition',
                current === n.id ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper-sunk hover:text-ink',
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
              {badge > 0 && <span className={cx('ml-auto rounded-full px-1.5 text-[11px] tabular-nums', current === n.id ? 'bg-white/20' : 'bg-bad text-white')}>{badge}</span>}
            </button>
          );
        })}
      </nav>
      <main className="min-w-0 flex-1">
        {current === 'home' && <Dashboard go={go} />}
        {current === 'widgets' && <WidgetsPage />}
        {current === 'leads' && <LeadsPage />}
        {current === 'chats' && <ChatsPage />}
        {current === 'scenarios' && <ScenariosPage />}
        {current === 'ab' && <ABPage />}
        {current === 'analytics' && <AnalyticsPage />}
        {current === 'integrations' && <IntegrationsPage />}
        {current === 'staff' && <StaffPage />}
        {current === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

export function RolePicker() {
  const role = useApp((s) => s.role);
  const staff = useApp((s) => s.staff);
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
      <span className="hidden sm:inline">Войти как</span>
      <select
        value={role}
        onChange={(e) => {
          const r = e.target.value as Role;
          const u = staff.find((x) => x.role === r);
          set({ role: r, userId: u?.id ?? '' });
        }}
        className="h-9 rounded-lg border border-paper-line bg-white px-2 text-xs font-semibold text-ink"
      >
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      <Demo />
    </label>
  );
}

export function NoticeBell() {
  const notices = useApp((s) => s.notices);
  const [open, setOpen] = useState(false);
  const unread = notices.filter((n) => !n.read).length;
  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) set((s) => ({ notices: s.notices.map((n) => ({ ...n, read: true })) }));
        }}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-paper-line bg-white"
        aria-label={`Уведомления: ${unread} новых`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[320px] max-w-[calc(100vw-32px)] rounded-2xl border border-paper-line bg-white p-2 shadow-float">
          <p className="px-2 py-1.5 text-xs font-bold text-ink-soft">Уведомления менеджерам</p>
          <ul className="max-h-80 overflow-y-auto">
            {notices.length === 0 && <li className="px-2 py-4 text-center text-xs text-ink-mute">Пока пусто. Отправьте тестовую заявку на «Сайте гостя».</li>}
            {notices.map((n) => (
              <li key={n.id} className="flex gap-2 rounded-lg px-2 py-2 text-xs hover:bg-paper-sunk">
                <span className="tabular-nums text-ink-mute">{fmtTime(n.at)}</span>
                <span className="text-ink">{n.text}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-paper-line px-2 pt-2 text-[10.5px] text-ink-mute">В проде дублируются в Bitrix24 (задача/уведомление) и в MAX/Telegram-чат отдела. Здесь - только в панели.</p>
        </div>
      )}
    </div>
  );
}
