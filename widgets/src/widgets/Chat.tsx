import { Bot, Check, CheckCheck, Clock3, Send, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { track } from '../core/analytics';
import { handleAction, handleGuestMessage, handleQuick, typing } from '../core/chatEngine';
import { ensureChat, openPanel, useApp } from '../core/store';
import type { ChatMessage } from '../core/types';
import { cx, fmtTime } from '../core/util';
import { PanelShell, useIsMobile } from './shared';
import { Demo } from '../ui/kit';

const typingState = new Set<string>();
const listeners = new Set<() => void>();
typing.set = (id, on) => {
  if (on) typingState.add(id);
  else typingState.delete(id);
  listeners.forEach((l) => l());
};
function useTyping(id: string | null) {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return id ? typingState.has(id) : false;
}

function DeliveryIcon({ d }: { d?: ChatMessage['delivery'] }) {
  if (d === 'sending') return <Clock3 className="h-3 w-3" aria-label="Отправляется" />;
  if (d === 'sent') return <Check className="h-3 w-3" aria-label="Отправлено" />;
  if (d === 'delivered') return <CheckCheck className="h-3 w-3" aria-label="Доставлено" />;
  if (d === 'read') return <CheckCheck className="h-3 w-3 text-sky-300" aria-label="Прочитано" />;
  return null;
}

export function ChatPanel({ preview }: { preview?: boolean }) {
  const cfg = useApp((s) => s.config.widgets.chat);
  const env = useApp((s) => s.env);
  const mobile = useIsMobile();
  const chatId = useApp((s) => s.activeChatId);
  const chat = useApp((s) => s.chats.find((c) => c.id === s.activeChatId));
  const isTyping = useTyping(chatId);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preview) return;
    ensureChat();
    track('widget_open', 'chat');
  }, [preview]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat?.messages.length, isTyping]);

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t || !chatId || preview) return;
    setText('');
    void handleGuestMessage(chatId, t);
  };

  const messages: ChatMessage[] = preview
    ? [{ id: 'p', at: Date.now(), from: 'bot', text: cfg.greeting }]
    : chat?.messages ?? [];
  const showQuick = !preview ? (chat?.messages.filter((m) => m.from === 'guest').length ?? 0) === 0 : true;
  const status =
    chat?.mode === 'manager' ? 'Администратор в чате' : chat?.mode === 'waiting_manager' ? 'Ждём администратора' : cfg.aiEnabled ? 'Виртуальный консультант' : 'Онлайн-чат';

  return (
    <PanelShell
      title={chat?.mode === 'manager' ? cfg.operatorName : 'Варшавка 125'}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <span className={cx('h-2 w-2 rounded-full', chat?.mode === 'waiting_manager' ? 'bg-amber-300' : 'bg-emerald-300')} />
          {status}
        </span>
      }
      badge={env !== 'live' && <Demo className="border-white/50 bg-white/10 text-white">{env === 'preview' ? 'предпросмотр' : 'DEMO'}</Demo>}
      onClose={() => openPanel(null)}
      className={cx(mobile && !preview ? 'h-full w-full' : 'h-[560px] max-h-full w-[380px] max-w-full rounded-2xl')}
    >
      <div ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto bg-paper px-4 py-4" aria-live="polite">
        {messages.map((m) => (
          <Bubble key={m.id} m={m} chatId={chatId} />
        ))}
        {isTyping && (
          <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm" aria-label="Консультант печатает">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-mute animate-dot" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        {showQuick && cfg.aiEnabled && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {cfg.quickActions.map((q) => (
              <button
                key={q}
                onClick={() => chatId && !preview && handleQuick(chatId, q)}
                className="rounded-full border border-brand/30 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand transition hover:bg-brand hover:text-brand-ink"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t border-paper-line bg-white p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напишите сообщение…"
          aria-label="Сообщение"
          maxLength={1000}
          className="h-11 flex-1 rounded-xl bg-paper-sunk px-3.5 text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <button type="submit" aria-label="Отправить" className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-brand-ink disabled:opacity-40" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </button>
      </form>
      <p className="bg-white px-4 pb-2 text-center text-[10.5px] text-ink-mute">
        {cfg.aiEnabled ? 'Отвечает виртуальный консультант по базе знаний отеля. Цены - только из системы бронирования.' : 'Отвечает администратор.'}
      </p>
    </PanelShell>
  );
}

function Bubble({ m, chatId }: { m: ChatMessage; chatId: string | null }) {
  if (m.from === 'system')
    return (
      <div className="my-1 flex flex-col items-center gap-2">
        <p className="max-w-[90%] rounded-lg bg-paper-sunk px-3 py-1.5 text-center text-[11.5px] text-ink-soft">{m.text}</p>
        {m.actions && <Actions m={m} chatId={chatId} />}
      </div>
    );
  const mine = m.from === 'guest';
  return (
    <div className={cx('flex max-w-[86%] flex-col gap-1.5 animate-rise', mine ? 'self-end items-end' : 'items-start')}>
      {!mine && (
        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-ink-mute">
          {m.from === 'bot' ? <Bot className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
          {m.from === 'bot' ? 'Консультант' : 'Администратор'}
          {m.unverified && <Demo className="ml-1 !px-1 !py-0">не подтверждено</Demo>}
        </span>
      )}
      <div
        className={cx(
          'whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug shadow-sm',
          mine ? 'rounded-br-md bg-brand text-brand-ink' : 'rounded-bl-md bg-white text-ink',
        )}
      >
        {m.text}
        <span className={cx('ml-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px]', mine ? 'text-brand-ink/70' : 'text-ink-mute')}>
          {fmtTime(m.at)}
          {mine && <DeliveryIcon d={m.delivery} />}
        </span>
      </div>
      {m.actions && <Actions m={m} chatId={chatId} />}
    </div>
  );
}

function Actions({ m, chatId }: { m: ChatMessage; chatId: string | null }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {m.actions!.map((a) =>
        a.href ? (
          <a
            key={a.label}
            href={a.href}
            target="_blank"
            rel="noreferrer"
            onClick={() => chatId && handleAction(chatId, a.action, a.label)}
            className="rounded-full bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-brand-ink hover:brightness-110"
          >
            {a.label} ↗
          </a>
        ) : (
          <button
            key={a.label}
            onClick={() => chatId && handleAction(chatId, a.action, a.label)}
            className="rounded-full border border-brand/30 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand hover:bg-brand hover:text-brand-ink"
          >
            {a.label}
          </button>
        ),
      )}
    </div>
  );
}
