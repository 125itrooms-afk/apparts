import { Check, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { set, useApp } from '../core/store';
import type { Role } from '../core/types';
import { uid } from '../core/util';
import { Button, Card, Demo, Input, PageHead, Select, Toggle } from '../ui/kit';
import { NAV, PERMS, ROLE_LABEL, useCan } from './AdminApp';

export function StaffPage() {
  const staff = useApp((s) => s.staff);
  const can = useCan('staff');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('manager');

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="Сотрудники" sub={<span>Роли и права доступа. Вход в прототипе - переключатель «Войти как» <Demo />. В проде: вход по e-mail + пароль/SSO, 2FA для руководителя и администратора.</span>} />
      <Card title="Команда">
        <fieldset disabled={!can} className="flex flex-col gap-2">
          {staff.map((m) => (
            <div key={m.id} className="grid grid-cols-[1fr_200px_auto] items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-paper">
              <span className="text-sm font-semibold">{m.name}</span>
              <Select value={m.role} onChange={(e) => set((s) => ({ staff: s.staff.map((x) => (x.id === m.id ? { ...x, role: e.target.value as Role } : x)) }))} options={(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
              <Toggle checked={m.active} onChange={(v) => set((s) => ({ staff: s.staff.map((x) => (x.id === m.id ? { ...x, active: v } : x)) }))} label={<span className="text-xs">{m.active ? 'активен' : 'отключён'}</span>} />
            </div>
          ))}
          <div className="mt-2 grid grid-cols-[1fr_200px_auto] gap-3 border-t border-paper-line pt-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя сотрудника" />
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)} options={(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
            <Button
              variant="outline"
              onClick={() => {
                if (!name.trim()) return;
                set((s) => ({ staff: [...s.staff, { id: uid('u_'), name: name.trim(), role, active: true }] }));
                setName('');
              }}
            >
              <Plus className="h-4 w-4" /> Добавить
            </Button>
          </div>
          <p className="text-[11px] text-ink-mute">Новые заявки распределяются между активными менеджерами бронирования по наименьшей текущей нагрузке.</p>
        </fieldset>
      </Card>
      <Card title="Матрица прав">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-ink-mute">
              <tr>
                <th className="py-2 font-semibold">Раздел</th>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <th key={r} className="py-2 font-semibold">{ROLE_LABEL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NAV.map((n) => (
                <tr key={n.id} className="border-t border-paper-line">
                  <td className="py-2 font-semibold">{n.label}</td>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <td key={r} className="py-2 text-xs">
                      {PERMS[r].edit.includes(n.id) ? (
                        <span className="inline-flex items-center gap-1 text-ok"><Check className="h-3.5 w-3.5" /> изменение</span>
                      ) : PERMS[r].view.includes(n.id) ? (
                        <span className="text-ink-soft">просмотр</span>
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-ink-mute" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-ink-mute">Права проверяются на сервере для каждого запроса API. Персональные данные гостей (телефоны, переписка) видят только роли с доступом к заявкам; все просмотры и изменения пишутся в журнал аудита.</p>
      </Card>
    </div>
  );
}
