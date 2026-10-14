import { Bot, Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { managerReply, returnToAI } from '../core/chatEngine';
import { patchChat, patchWidget, setConfig, useApp } from '../core/store';
import { cx, fmtDateTime, fmtTime, ruDate, uid } from '../core/util';
import { Badge, Button, Card, Demo, Empty, Field, Input, PageHead, Segmented, Textarea, Toggle } from '../ui/kit';
import { useCan } from './AdminApp';

export function ChatsPage() {
  const [tab, setTab] = useState<'chats' | 'kb'>('chats');
  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="Чаты"
        sub="Переписки с гостями, передача менеджеру и база знаний консультанта."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'chats', label: 'Переписки' }, { value: 'kb', label: 'База знаний' }]} />}
      />
      {tab === 'chats' ? <Conversations /> : <KnowledgeBase />}
    </div>
  );
}

function Conversations() {
  const chats = useApp((s) => s.chats);
  const userId = useApp((s) => s.userId);
  const aiEnabled = useApp((s) => s.config.widgets.chat.aiEnabled);
  const canEditWidget = useCan('widgets');
  const can = useCan('chats');
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState('');
  const chat = chats.find((c) => c.id === sel) ?? chats[0];
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chat && chat.unreadForManager) patchChat(chat.id, (c) => ({ ...c, unreadForManager: 0 }));
  }, [chat?.id, chat?.unreadForManager]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chat?.messages.length]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-paper-line bg-white px-4 py-3">
        <Toggle
          checked={aiEnabled}
          disabled={!canEditWidget}
          onChange={(v) => patchWidget('chat', { aiEnabled: v })}
          label={<span className="text-sm">ИИ-консультант на сайте {aiEnabled ? '' : '(выключен: все новые чаты сразу идут людям)'}</span>}
        />
        <span className="text-xs text-ink-mute">Ответы ИИ в прототипе - правила + база знаний, без LLM. <Demo /></span>
      </div>
      {chats.length === 0 ? (
        <Empty title="Переписок пока нет" text="Откройте «Сайт гостя», напишите в чат - диалог появится здесь, и на него можно ответить как менеджер." />
      ) : (
        <div className="grid min-h-[520px] gap-4 lg:grid-cols-[300px_1fr]">
          <ul className="flex flex-col gap-1 rounded-2xl border border-paper-line bg-white p-2">
            {chats.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <li key={c.id}>
                  <button onClick={() => setSel(c.id)} className={cx('flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left', chat?.id === c.id ? 'bg-paper-sunk' : 'hover:bg-paper')}>
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                      Гость {c.visitorId.slice(2, 7)}
                      {c.mode === 'waiting_manager' ? <Badge tone="bad">ждёт</Badge> : c.mode === 'manager' ? <Badge tone="info">менеджер</Badge> : <Badge>ИИ</Badge>}
                    </span>
                    <span className="truncate text-xs text-ink-mute">{last?.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {chat && (
            <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-paper-line bg-white">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-line px-4 py-3">
                <div className="min-w-0 text-xs text-ink-soft">
                  <p className="text-sm font-bold text-ink">Начат {fmtDateTime(chat.startedAt)}</p>
                  {[
                    chat.slots.checkIn && `даты ${ruDate(chat.slots.checkIn)}-${chat.slots.checkOut ? ruDate(chat.slots.checkOut) : '?'}`,
                    chat.slots.guests && `гостей ${chat.slots.guests}`,
                    chat.slots.purpose,
                    chat.slots.phone,
                    chat.leadId && 'заявка создана',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Данные гостя ещё не собраны'}
                </div>
                {chat.mode !== 'ai' && aiEnabled && can && (
                  <Button size="sm" variant="outline" onClick={() => returnToAI(chat.id)}>
                    <Bot className="h-3.5 w-3.5" /> Вернуть ИИ
                  </Button>
                )}
              </header>
              <div ref={list} className="flex flex-1 flex-col gap-2 overflow-y-auto bg-paper p-4">
                {chat.messages.map((m) => (
                  <div key={m.id} className={cx('flex max-w-[80%] flex-col', m.from === 'guest' ? 'self-start' : m.from === 'system' ? 'self-center' : 'self-end items-end')}>
                    <span className="text-[10.5px] text-ink-mute">
                      {{ guest: 'Гость', bot: 'ИИ-консультант', manager: 'Менеджер', system: 'Система' }[m.from]} · {fmtTime(m.at)}
                    </span>
                    <p className={cx('whitespace-pre-line rounded-2xl px-3 py-2 text-sm', m.from === 'guest' ? 'bg-white' : m.from === 'system' ? 'bg-paper-sunk text-xs text-ink-soft' : m.from === 'bot' ? 'bg-sage-soft' : 'bg-ink text-white')}>
                      {m.text}
                    </p>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!text.trim() || !can) return;
                  managerReply(chat.id, text.trim(), userId);
                  setText('');
                }}
                className="flex gap-2 border-t border-paper-line p-3"
              >
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={can ? 'Ответить гостю как менеджер…' : 'Нет прав на ответ'} disabled={!can} aria-label="Ответ гостю" />
                <Button type="submit" disabled={!can || !text.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function KnowledgeBase() {
  const kb = useApp((s) => s.config.kb);
  const can = useCan('widgets');
  const upd = (id: string, patch: object) => setConfig((c) => ({ ...c, kb: c.kb.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl bg-warn/10 px-4 py-3 text-xs leading-relaxed text-warn">
        Записи ниже - черновики-заготовки (DEMO). Консультант отвечает только тем, что здесь написано. После подключения интеграций неподтверждённые записи не используются: отметьте «Подтверждено отелем» после проверки. Цены и наличие в базу знаний не вносятся - их даёт Bnovo.
      </p>
      {kb.map((e) => (
        <Card
          key={e.id}
          title={e.topic}
          actions={
            <div className="flex items-center gap-3">
              <Toggle checked={e.confirmed} disabled={!can} onChange={(v) => upd(e.id, { confirmed: v })} label={<span className="text-xs">Подтверждено отелем</span>} />
              {can && (
                <button onClick={() => setConfig((c) => ({ ...c, kb: c.kb.filter((x) => x.id !== e.id) }))} className="rounded p-1 text-ink-mute hover:text-bad" aria-label="Удалить запись">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          }
        >
          <fieldset disabled={!can} className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <Field label="Тема"><Input value={e.topic} onChange={(x) => upd(e.id, { topic: x.target.value })} /></Field>
            <Field label="Ключевые слова" hint="Через запятую - по ним консультант находит ответ"><Input value={e.keywords} onChange={(x) => upd(e.id, { keywords: x.target.value })} /></Field>
            <div className="md:col-span-2">
              <Field label="Ответ" hint={e.answer ? undefined : 'Пусто: консультант скажет, что информации нет, и предложит администратора.'}>
                <Textarea value={e.answer} onChange={(x) => upd(e.id, { answer: x.target.value })} />
              </Field>
            </div>
          </fieldset>
        </Card>
      ))}
      {can && (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setConfig((c) => ({ ...c, kb: [...c.kb, { id: uid('kb-'), topic: 'Новая тема', keywords: '', answer: '', confirmed: false }] }))}
        >
          <Plus className="h-4 w-4" /> Добавить запись
        </Button>
      )}
    </div>
  );
}
