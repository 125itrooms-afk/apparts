import { Clock, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { REFUSAL_REASONS, SOURCE_LABEL, STATUS_LABEL } from '../core/defaults';
import { bitrixPayload } from '../core/leads';
import { leadChannel } from '../core/metrics';
import { addLeadEvent, updateLead, useApp } from '../core/store';
import type { Lead, LeadStatus } from '../core/types';
import { cx, fmtDateTime, minutesAgo, money } from '../core/util';
import { Badge, Button, Demo, Drawer, Empty, Field, Input, PageHead, Select, Textarea } from '../ui/kit';
import { useCan } from './AdminApp';

export const STATUS_TONE: Record<LeadStatus, 'neutral' | 'ok' | 'warn' | 'bad' | 'brand' | 'info'> = {
  new: 'bad',
  in_progress: 'warn',
  reached: 'info',
  not_reached: 'neutral',
  booked: 'ok',
  rejected: 'neutral',
};

export function LeadsPage() {
  const leads = useApp((s) => s.leads);
  const staff = useApp((s) => s.staff);
  const role = useApp((s) => s.role);
  const userId = useApp((s) => s.userId);
  const sla = useApp((s) => s.config.reminders.firstAfterMin);
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [manager, setManager] = useState(role === 'manager' ? userId : '');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      leads.filter(
        (l) =>
          (!status || l.status === status) &&
          (!source || l.source === source) &&
          (!manager || l.managerId === manager) &&
          (!q || `${l.num} ${l.name ?? ''} ${l.phone ?? ''} ${l.email ?? ''}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [leads, status, source, manager, q],
  );
  const open = leads.find((l) => l.id === openId) ?? null;
  const mName = (id?: string) => staff.find((s) => s.id === id)?.name ?? '-';

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="Заявки" sub="Единый список обращений из всех виджетов. Тестовые заявки с «Сайта гостя» появляются здесь сразу." />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <label className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-ink-mute" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="№, имя, телефон, e-mail" className="pl-9" aria-label="Поиск" />
        </label>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Статус" options={[{ value: '', label: 'Все статусы' }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Виджет" options={[{ value: '', label: 'Все виджеты' }, ...Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Select
          value={manager}
          onChange={(e) => setManager(e.target.value)}
          aria-label="Менеджер"
          options={[{ value: '', label: 'Все менеджеры' }, ...staff.filter((s) => s.role === 'manager').map((s) => ({ value: s.id, label: s.name }))]}
        />
      </div>

      {rows.length === 0 ? (
        <Empty title="Заявок по фильтру нет" text="Откройте «Сайт гостя» и отправьте тестовую заявку через обратный звонок, чат, квиз или всплывающее окно." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-paper-line bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-paper-line text-left text-xs text-ink-mute">
              <tr>
                <th className="px-4 py-3 font-semibold">№</th>
                <th className="px-4 py-3 font-semibold">Создана</th>
                <th className="px-4 py-3 font-semibold">Контакт</th>
                <th className="px-4 py-3 font-semibold">Виджет</th>
                <th className="px-4 py-3 font-semibold">Источник</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Ответственный</th>
                <th className="px-4 py-3 font-semibold">SLA</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((l) => {
                const age = minutesAgo(l.createdAt);
                const resp = l.firstResponseAt ? Math.round((l.firstResponseAt - l.createdAt) / 60000) : null;
                const overdue = l.status === 'new' && age > sla;
                return (
                  <tr key={l.id} onClick={() => setOpenId(l.id)} className={cx('cursor-pointer border-b border-paper-line/70 last:border-0 hover:bg-paper', overdue && 'bg-bad/[0.03]')}>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      #{l.num} {l.id.startsWith('demo') && <Demo className="ml-1" />}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-soft">{fmtDateTime(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{l.name || 'Без имени'}</span>
                      <span className="block text-xs tabular-nums text-ink-mute">{l.phone || l.email}</span>
                    </td>
                    <td className="px-4 py-3">{SOURCE_LABEL[l.source]}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {leadChannel(l).source}
                      {l.utm.utm_campaign && <span className="block text-ink-mute">{l.utm.utm_campaign}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                      {l.duplicateOf && <span className="ml-1 text-[11px] text-ink-mute">повтор</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{mName(l.managerId)}</td>
                    <td className="px-4 py-3">
                      {resp !== null ? (
                        <span className={cx('text-xs tabular-nums', resp > sla ? 'text-bad' : 'text-ok')}>ответ {resp} мин</span>
                      ) : l.status === 'new' ? (
                        <Badge tone={overdue ? 'bad' : 'warn'}>
                          <Clock className="h-3 w-3" /> {age > 120 ? `${Math.round(age / 60)} ч` : `${age} мин`}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <LeadDrawer lead={open} onClose={() => setOpenId(null)} />
    </div>
  );
}

function LeadDrawer({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const staff = useApp((s) => s.staff);
  const chat = useApp((s) => (lead?.chatId ? s.chats.find((c) => c.id === lead.chatId) : undefined));
  const can = useCan('leads');
  const userName = useApp((s) => s.staff.find((x) => x.id === s.userId)?.name ?? 'Пользователь');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [showCrm, setShowCrm] = useState(false);
  if (!lead) return null;

  const setStatus = (st: LeadStatus) => updateLead(lead.id, { status: st }, `${userName}: статус → «${STATUS_LABEL[st]}»`);

  return (
    <Drawer open onClose={onClose} title={`Заявка #${lead.num}`} wide>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
          <Badge>{SOURCE_LABEL[lead.source]}</Badge>
          {lead.demo && <Demo />}
          {lead.duplicateOf && <Badge tone="info">Повторное обращение</Badge>}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-paper-line bg-white p-4 text-sm sm:grid-cols-3">
          <Info k="Имя" v={lead.name || '-'} />
          <Info k="Телефон" v={lead.phone ? <span className="select-all tabular-nums">{lead.phone}</span> : '-'} />
          <Info k="E-mail" v={lead.email || '-'} />
          <Info k="Создана" v={fmtDateTime(lead.createdAt)} />
          <Info k="Удобное время" v={lead.preferredTime || '-'} />
          <Info k="Устройство" v={lead.device === 'mobile' ? 'Телефон' : 'Компьютер'} />
          <Info k="Страница" v={lead.page} />
          <Info k="UTM" v={Object.entries(lead.utm).map(([k, v]) => `${k.replace('utm_', '')}=${v}`).join(', ') || '-'} />
          <Info k="Bitrix24" v={lead.crm.state === 'not_connected' ? 'не подключён' : lead.crm.state} />
          {lead.comment && <Info k="Комментарий" v={lead.comment} wide />}
          {lead.quiz && <Info k="Ответы квиза" v={Object.entries(lead.quiz).map(([k, v]) => `${k}: ${v}`).join(' · ')} wide />}
        </dl>

        <fieldset disabled={!can} className="flex flex-col gap-3 rounded-2xl border border-paper-line bg-white p-4">
          <p className="text-sm font-bold">Обработка</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={cx('rounded-full border px-3 py-1 text-xs font-semibold', lead.status === s ? 'border-ink bg-ink text-white' : 'border-paper-line hover:border-ink/30')}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ответственный">
              <Select
                value={lead.managerId ?? ''}
                onChange={(e) => updateLead(lead.id, { managerId: e.target.value }, `${userName}: назначен ${staff.find((s) => s.id === e.target.value)?.name}`)}
                options={[{ value: '', label: 'Не назначен' }, ...staff.filter((s) => s.role === 'manager').map((s) => ({ value: s.id, label: s.name }))]}
              />
            </Field>
            {lead.status === 'rejected' && (
              <Field label="Причина отказа">
                <Select value={lead.refusalReason ?? ''} onChange={(e) => updateLead(lead.id, { refusalReason: e.target.value }, `Причина отказа: ${e.target.value}`)} options={[{ value: '', label: 'Выберите…' }, ...REFUSAL_REASONS.map((r) => ({ value: r, label: r }))]} />
              </Field>
            )}
            {lead.status === 'booked' && (
              <Field label="Сумма брони, ₽" hint="В проде подтягивается из Bnovo при сопоставлении брони. Ручной ввод помечается как неподтверждённый.">
                <div className="flex gap-2">
                  <Input type="number" min={0} value={amount || lead.booking?.amount || ''} onChange={(e) => setAmount(e.target.value)} />
                  <Button variant="soft" onClick={() => updateLead(lead.id, { booking: { amount: Number(amount) || 0, nights: lead.booking?.nights ?? 1, confirmed: false } }, `Указана сумма брони ${amount} ₽ (не подтверждена Bnovo)`)}>
                    Сохранить
                  </Button>
                </div>
              </Field>
            )}
          </div>
          {lead.booking && (
            <p className="text-xs text-ink-soft">
              Бронь: {money(lead.booking.amount)} · {lead.booking.confirmed ? <Badge tone="ok">подтверждена в Bnovo {lead.booking.bnovoId}</Badge> : <Badge tone="warn">не подтверждена Bnovo - в выручку не входит</Badge>}
            </p>
          )}
          <div className="flex gap-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий к заявке" className="min-h-[44px]" />
            <Button
              variant="outline"
              onClick={() => {
                if (!note.trim()) return;
                addLeadEvent(lead.id, { kind: 'manager', text: `${userName}: ${note.trim()}` });
                setNote('');
              }}
            >
              Добавить
            </Button>
          </div>
        </fieldset>

        <div className="rounded-2xl border border-paper-line bg-white p-4">
          <p className="mb-3 text-sm font-bold">История действий</p>
          <ol className="relative flex flex-col gap-3 border-l border-paper-line pl-4">
            {lead.history.map((h, i) => (
              <li key={i} className="relative text-sm">
                <span className={cx('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', h.kind === 'client' ? 'bg-sage' : h.kind === 'manager' ? 'bg-ink' : 'bg-ink-mute/50')} />
                <span className="mr-2 text-xs tabular-nums text-ink-mute">{fmtDateTime(h.at)}</span>
                <span className="text-ink">{h.text}</span>
              </li>
            ))}
          </ol>
        </div>

        {chat && (
          <div className="rounded-2xl border border-paper-line bg-white p-4">
            <p className="mb-2 text-sm font-bold">Переписка в чате</p>
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto text-sm">
              {chat.messages.map((m) => (
                <p key={m.id} className={cx('rounded-lg px-3 py-1.5', m.from === 'guest' ? 'self-end bg-ink text-white' : 'self-start bg-paper')}>
                  {m.text}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-dashed border-paper-line p-4">
          <button onClick={() => setShowCrm(!showCrm)} className="text-sm font-semibold text-sage underline underline-offset-4">
            {showCrm ? 'Скрыть' : 'Показать'}, что уйдёт в Bitrix24
          </button>
          {showCrm && (
            <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-ink p-3 text-[11px] leading-relaxed text-white">{JSON.stringify(bitrixPayload(lead), null, 2)}</pre>
          )}
          <p className="mt-2 text-[11px] text-ink-mute">Интеграция не подключена: запрос не отправляется. Это формат вызова crm.lead.add, который выполнит сервер.</p>
        </div>
      </div>
    </Drawer>
  );
}

function Info({ k, v, wide }: { k: string; v: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cx('min-w-0', wide && 'col-span-2 sm:col-span-3')}>
      <dt className="text-[11px] font-semibold text-ink-mute">{k}</dt>
      <dd className="break-words text-ink">{v}</dd>
    </div>
  );
}
