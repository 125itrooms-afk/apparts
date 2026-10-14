import { CheckCircle2, CircleDashed, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { GOALS } from '../core/analytics';
import { setConfig, useApp } from '../core/store';
import type { EventName, IntegrationId } from '../core/types';
import { Badge, Button, Card, Field, Input, PageHead } from '../ui/kit';
import { useCan } from './AdminApp';

const INFO: Record<IntegrationId, { title: string; does: string[]; needs: string[]; params: { key: string; label: string; hint?: string }[]; secret: string }> = {
  bnovo: {
    title: 'Bnovo',
    does: [
      'Наличие и тарифы по категориям на даты (квиз, чат)',
      'Передача дат и гостей в модуль бронирования',
      'Факты для уведомлений о бронированиях (только по порогам)',
      'Сопоставление заявок с бронями: телефон/e-mail → booking_id, сумма, статус, канал',
    ],
    needs: ['API-ключ Bnovo PMS (api.pms.bnovo.ru) с правом чтения броней и номеров', 'ID отеля', 'UID модуля бронирования'],
    params: [
      { key: 'hotelId', label: 'ID отеля в Bnovo' },
      { key: 'moduleUid', label: 'UID модуля бронирования', hint: 'Используется в ссылке reservationsteps.ru' },
    ],
    secret: 'BNOVO_API_KEY',
  },
  bitrix24: {
    title: 'Bitrix24',
    does: [
      'Создание лидов (crm.lead.add) и сделок в воронке «Бронирования»',
      'Контакты, источник, UTM-метки, история переписки (комментарий/таймлайн)',
      'Ответственный по правилу распределения, задачи-напоминания',
      'Защита от дублей: crm.duplicate.findbycomm по телефону/e-mail',
      'Обратная синхронизация статусов через исходящий вебхук (ONCRMLEADUPDATE)',
    ],
    needs: ['Входящий вебхук с правами CRM (или локальное приложение OAuth)', 'ID воронки и стадий', 'Соответствие сотрудников панели пользователям Bitrix24'],
    params: [
      { key: 'portal', label: 'Адрес портала', hint: 'например, varshavka125.bitrix24.ru' },
      { key: 'pipeline', label: 'Воронка сделок' },
    ],
    secret: 'BITRIX24_WEBHOOK_URL',
  },
  metrika: {
    title: 'Яндекс Метрика',
    does: [
      'Цели по событиям виджетов (reachGoal) - список ниже',
      'Офлайн-конверсии: подтверждённые брони и выручка загружаются по ClientID через API Метрики',
      'Выручка - только при достоверной атрибуции (бронь сопоставлена с лидом)',
    ],
    needs: ['Номер счётчика на сайте', 'OAuth-токен с правом metrika:write для офлайн-конверсий', 'Создать цели «JavaScript-событие» с именами ниже'],
    params: [{ key: 'counterId', label: 'Номер счётчика' }],
    secret: 'METRIKA_OAUTH_TOKEN',
  },
  telephony: {
    title: 'Телефония (обратный звонок)',
    does: ['Автоматический звонок менеджеру, затем гостю (callback API провайдера)', 'Статус «дозвонились/не дозвонились» и запись разговора в заявку'],
    needs: ['Провайдер с callback API (например, Mango Office, UIS, Bitrix24 телефония)', 'Ключи API провайдера'],
    params: [{ key: 'provider', label: 'Провайдер' }],
    secret: 'TELEPHONY_API_KEY',
  },
};

export function IntegrationsPage() {
  const list = useApp((s) => s.config.integrations);
  const can = useCan('integrations');
  const [msg, setMsg] = useState<Record<string, string>>({});
  const upd = (id: IntegrationId, params: Record<string, string>) =>
    setConfig((c) => ({ ...c, integrations: c.integrations.map((i) => (i.id === id ? { ...i, params } : i)) }));

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="Интеграции"
        sub="В прототипе ни одна интеграция не подключена: нет сервера, который хранит ключи и ходит в API. Ниже - что даёт каждая интеграция и что нужно для запуска."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {list.map((i) => {
          const info = INFO[i.id];
          return (
            <Card
              key={i.id}
              title={info.title}
              actions={i.connected ? <Badge tone="ok"><CheckCircle2 className="h-3 w-3" /> подключено</Badge> : <Badge><CircleDashed className="h-3 w-3" /> не подключено</Badge>}
            >
              <div className="flex flex-col gap-4 text-sm">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-mute">Что делает</p>
                  <ul className="list-disc space-y-1 pl-5 text-ink-soft">{info.does.map((d) => <li key={d}>{d}</li>)}</ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-mute">Что нужно</p>
                  <ul className="list-disc space-y-1 pl-5 text-ink-soft">{info.needs.map((d) => <li key={d}>{d}</li>)}</ul>
                </div>
                <fieldset disabled={!can} className="grid gap-3 sm:grid-cols-2">
                  {info.params.map((p) => (
                    <Field key={p.key} label={p.label} hint={p.hint}>
                      <Input value={i.params[p.key] ?? ''} onChange={(e) => upd(i.id, { ...i.params, [p.key]: e.target.value })} />
                    </Field>
                  ))}
                  <Field label="Секретный ключ" hint={`Хранится только на сервере в переменной ${info.secret}. В браузер не передаётся и здесь не вводится.`}>
                    <div className="flex h-10 items-center gap-2 rounded-xl border border-dashed border-paper-line bg-paper-sunk px-3 text-xs text-ink-mute">
                      <KeyRound className="h-4 w-4" /> задаётся на сервере
                    </div>
                  </Field>
                </fieldset>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" disabled={!can} onClick={() => setMsg({ ...msg, [i.id]: 'Проверка невозможна: серверная часть не развёрнута. Запрос не отправлялся.' })}>
                    Проверить подключение
                  </Button>
                  {msg[i.id] && <span className="text-xs text-warn">{msg[i.id]}</span>}
                </div>
                {i.id === 'metrika' && <GoalsTable />}
              </div>
            </Card>
          );
        })}
      </div>
      <Card title="Вебхуки и API">
        <div className="grid gap-4 text-sm lg:grid-cols-2">
          <div>
            <p className="mb-2 font-semibold">Входящие (сервер принимает)</p>
            <ul className="space-y-1 font-mono text-xs text-ink-soft">
              <li>POST /api/public/leads - заявка из виджета (rate limit, капча при подозрении)</li>
              <li>POST /api/public/events - события виджетов (батч)</li>
              <li>POST /api/public/chat/:id/messages - сообщение гостя</li>
              <li>POST /hooks/bitrix24 - смена статуса лида/сделки</li>
              <li>POST /hooks/bnovo - новая/изменённая бронь (или опрос API раз в 5 мин)</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 font-semibold">Исходящие (сервер вызывает)</p>
            <ul className="space-y-1 font-mono text-xs text-ink-soft">
              <li>Bitrix24: crm.lead.add, crm.duplicate.findbycomm, crm.timeline.comment.add, tasks.task.add</li>
              <li>Bnovo: /api/v1/auth, /api/v1/bookings, /api/v1/rooms, тарифы/наличие</li>
              <li>Метрика: Management API - offline_conversions/upload</li>
              <li>Уведомления: MAX/Telegram-бот чата отдела бронирования</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function GoalsTable() {
  const rows: [EventName, string][] = [
    ['widget_impression', 'Показ виджета'],
    ['widget_open', 'Открытие'],
    ['form_start', 'Начало заполнения'],
    ['lead_submit', 'Отправка заявки'],
    ['booking_click', 'Переход в бронирование'],
  ];
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-mute">Цели Метрики</p>
      <ul className="space-y-1 text-xs">
        {rows.map(([e, l]) => (
          <li key={e} className="flex justify-between gap-2">
            <span className="text-ink-soft">{l}</span>
            <code className="text-ink">{GOALS[e]('callback' as never).replace('callback', '{виджет}')}</code>
          </li>
        ))}
        <li className="flex justify-between gap-2">
          <span className="text-ink-soft">Подтверждённая бронь (офлайн-конверсия, с выручкой)</span>
          <code className="text-ink">v125_booking_confirmed</code>
        </li>
      </ul>
    </div>
  );
}
