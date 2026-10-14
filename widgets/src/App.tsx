import { LayoutDashboard, MonitorSmartphone } from 'lucide-react';
import { useEffect } from 'react';
import { AdminApp, NoticeBell, RolePicker } from './admin/AdminApp';
import { seedLeads } from './core/demoData';
import { get, set, useApp } from './core/store';
import { cx, safeStorage } from './core/util';
import { GuestView } from './site/GuestView';
import { useBrandVars } from './widgets/WidgetHost';

/** Первичное наполнение панели DEMO-заявками (один раз на браузер) */
function useSeed() {
  useEffect(() => {
    if (safeStorage.get('v125-seeded-v2', false) || get().leads.length) return;
    const seeded = seedLeads(24);
    set((s) => ({ leads: [...s.leads, ...seeded], leadSeq: Math.max(s.leadSeq, ...seeded.map((l) => l.num)) + 1000 }));
    safeStorage.set('v125-seeded-v2', true);
  }, []);
}

export function App() {
  useSeed();
  const mode = useApp((s) => s.mode);
  const vars = useBrandVars();

  return (
    <div className="flex min-h-screen flex-col" style={vars}>
      <header
        className="sticky z-40 border-b border-paper-line bg-white/95 backdrop-blur"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex flex-wrap items-center gap-3 py-3" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-display text-lg leading-none">Варшавка 125</span>
            <span className="hidden text-xs font-semibold text-ink-mute sm:inline">Smart Booking Widgets</span>
          </div>
          <span className="rounded-md border border-dashed border-warn/60 bg-warn/10 px-2 py-0.5 text-[11px] font-bold text-warn" title="Интеграции не подключены. Все данные - тестовые.">
            DEMO-режим · интеграции не подключены
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-paper-sunk p-1" role="tablist" aria-label="Режим просмотра">
              {(
                [
                  ['site', 'Сайт гостя', MonitorSmartphone],
                  ['admin', 'Панель управления', LayoutDashboard],
                ] as const
              ).map(([m, label, Icon]) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => set({ mode: m, open: null, popup: null })}
                  className={cx('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition', mode === m ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink')}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            {mode === 'admin' && (
              <>
                <RolePicker />
                <NoticeBell />
              </>
            )}
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col py-4" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        {mode === 'site' ? <GuestView /> : <AdminApp />}
      </div>
    </div>
  );
}
