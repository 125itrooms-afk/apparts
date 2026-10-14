import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { track } from '../core/analytics';
import { abVariant, parseInview, pickScenario, type BehaviorCtx } from '../core/rules';
import { get, markShown, markVisitorAction, openPanel, set, useApp, type OpenPanel } from '../core/store';
import { cx, hexToRgbTriplet, pageMatches } from '../core/util';
import { CallbackPanel } from './Callback';
import { ChatPanel } from './Chat';
import { LeadPopup } from './LeadPopup';
import { Launchers, MultiButton } from './MultiButton';
import { QuizPanel } from './Quiz';
import { useHost, useIsMobile, useWidgetVisible } from './shared';
import { SocialProof } from './SocialProof';
import { VideoWidget } from './Video';

export const EXIT_EVENT = 'v125:exit';

/** CSS-переменные бренда для всех виджетов */
export function useBrandVars(): CSSProperties {
  const b = useApp((s) => s.config.branding);
  return {
    ['--v125-brand' as string]: hexToRgbTriplet(b.brand),
    ['--v125-brand-ink' as string]: hexToRgbTriplet(b.brandInk),
    ['--v125-font' as string]: b.font,
    ['--v125-display' as string]: b.fontDisplay,
  };
}

/** Селекторы блоков страницы из триггеров «inview» всех сценариев */
function inviewSelectors(): string[] {
  return [
    ...new Set(
      get()
        .config.widgets.leadPopup.scenarios.flatMap((sc) => sc.triggers)
        .filter((t) => t.type === 'inview')
        .map((t) => parseInview(t.value)[0])
        .filter(Boolean),
    ),
  ];
}

/** Поведенческий движок: время, прокрутка, уход с сайта → сценарии генератора заявок. */
function useBehaviorEngine() {
  const host = useHost();
  const path = useApp((s) => s.sim.path);
  const siteStart = useRef(Date.now());
  const pageStart = useRef(Date.now());
  const scrollPct = useRef(0);
  const exitAt = useRef(0);
  const sessionShown = useRef(0);
  const visible = useRef(new Set<string>());
  const inview = useRef<Record<string, number>>({});
  const scenarios = useApp((s) => s.config.widgets.leadPopup.scenarios);

  // Какие блоки страницы сейчас на экране (для триггера «inview»)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sels = inviewSelectors();
    const els: [Element, string][] = [];
    sels.forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => els.push([el, sel]));
      } catch {
        /* неверный селектор в настройках - пропускаем */
      }
    });
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const sel = els.find(([el]) => el === e.target)?.[1];
          if (!sel) return;
          if (e.isIntersecting && e.intersectionRatio >= 0.3) visible.current.add(sel);
          else visible.current.delete(sel);
        }),
      { threshold: [0, 0.3, 0.6] },
    );
    els.forEach(([el]) => io.observe(el));
    return () => io.disconnect();
  }, [scenarios, path]);

  useEffect(() => {
    pageStart.current = Date.now();
    scrollPct.current = 0;
    track('page_view', undefined, { path });
  }, [path]);

  useEffect(() => {
    const el = host.scrollEl();
    if (!el) return;
    let lastY = 0;
    let lastT = Date.now();
    const onScroll = () => {
      const isWin = el === window;
      const y = isWin ? window.scrollY : (el as HTMLElement).scrollTop;
      const max = isWin ? document.documentElement.scrollHeight - window.innerHeight : (el as HTMLElement).scrollHeight - (el as HTMLElement).clientHeight;
      scrollPct.current = Math.max(scrollPct.current, max > 0 ? Math.round((y / max) * 100) : 100);
      // мобильный аналог exit intent: резкая прокрутка вверх у начала страницы
      const now = Date.now();
      const v = (lastY - y) / Math.max(1, now - lastT);
      if (get().sim.frame === 'mobile' && v > 2.5 && y < 400) exitAt.current = now;
      lastY = y;
      lastT = now;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [host, path]);

  useEffect(() => {
    const onExit = () => (exitAt.current = Date.now());
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY < 8) onExit();
    };
    window.addEventListener(EXIT_EVENT, onExit);
    if (host.embedded) document.addEventListener('mouseout', onMouseOut);
    return () => {
      window.removeEventListener(EXIT_EVENT, onExit);
      document.removeEventListener('mouseout', onMouseOut);
    };
  }, [host]);

  useEffect(() => {
    const t = window.setInterval(() => {
      visible.current.forEach((sel) => (inview.current[sel] = (inview.current[sel] ?? 0) + 1));
      const s = get();
      if (s.popup || s.open) return;
      const cfg = s.config.widgets.leadPopup;
      if (!cfg.enabled || !pageMatches(s.sim.path, cfg.pages.include, cfg.pages.exclude)) return;
      if (s.sim.frame === 'mobile' && cfg.mobile === 'hide') return;
      const ctx: BehaviorCtx = {
        secondsOnSite: (Date.now() - siteStart.current) / 1000,
        secondsOnPage: (Date.now() - pageStart.current) / 1000,
        scrollPct: scrollPct.current,
        exitIntent: Date.now() - exitAt.current < 3000,
        path: s.sim.path,
        inview: inview.current,
      };
      const sc = pickScenario(ctx, sessionShown.current);
      if (!sc) return;
      const v = abVariant(s.config.abTests.find((x) => x.id === sc.abTestId));
      sessionShown.current++;
      markShown('popup:' + sc.id);
      set({
        popup: {
          scenarioId: sc.id,
          variantId: v?.id,
          title: v?.title ?? sc.title,
          text: v?.text ?? sc.text,
          button: v?.button ?? sc.button,
        },
      });
      track('widget_impression', 'leadPopup', { scenario: sc.id, ...(v ? { variant: v.id } : {}) });
      exitAt.current = 0;
    }, 1000);
    return () => clearInterval(t);
  }, []);
}

/**
 * Подъём виджетов над плавающими элементами сайта (нижняя панель бронирования, cookie-плашка и т.п.).
 * Элемент учитывается, если он видим, находится у нижнего края экрана и заходит в зону угла (380 px от края).
 */
function useAvoidOffsets() {
  const sels = useApp((s) => s.config.layout.avoidSelectors);
  const base = useApp((s) => s.config.layout.bottomOffset);
  const [off, setOff] = useState({ left: base, right: base });
  useEffect(() => {
    const calc = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const next = { left: base, right: base };
      sels.forEach((sel) => {
        let list: NodeListOf<Element>;
        try {
          list = document.querySelectorAll(sel);
        } catch {
          return;
        }
        list.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || (el as HTMLElement).hidden) return;
          // прижат к низу экрана (с учётом собственного отступа элемента) и не выше середины
          if (r.bottom < H - 120 || r.top < H * 0.4) return;
          const lift = Math.ceil(H - r.top + 12);
          if (r.left < 380) next.left = Math.max(next.left, lift);
          if (r.right > W - 380) next.right = Math.max(next.right, lift);
        });
      });
      setOff((o) => (o.left === next.left && o.right === next.right ? o : next));
    };
    calc();
    const t = window.setInterval(calc, 700);
    window.addEventListener('resize', calc);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', calc);
    };
  }, [sels, base]);
  return off;
}

function Corner({ side, children, lift }: { side: 'left' | 'right'; children: ReactNode; lift: number }) {
  return (
    <div
      className={cx('pointer-events-none absolute flex flex-col-reverse gap-3 transition-[bottom] duration-300', side === 'left' ? 'items-start' : 'items-end')}
      style={{
        bottom: `calc(${lift}px + env(safe-area-inset-bottom, 0px))`,
        [side]: `calc(20px + env(safe-area-inset-${side}, 0px))`,
      }}
    >
      {children}
    </div>
  );
}

export function WidgetHost() {
  useBehaviorEngine();
  const off = useAvoidOffsets();

  // Кнопки сайта: data-v125-open="quiz|callback|chat" открывает виджет, data-v125-action="..." отмечает действие
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const opener = t?.closest?.('[data-v125-open]');
      if (opener) {
        e.preventDefault();
        openPanel(opener.getAttribute('data-v125-open') as OpenPanel);
        return;
      }
      const act = t?.closest?.('[data-v125-action]');
      if (act) markVisitorAction(act.getAttribute('data-v125-action') || '');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  const vars = useBrandVars();
  const mobile = useIsMobile();
  const open = useApp((s) => s.open);
  const popup = useApp((s) => s.popup);
  const mbVisible = useWidgetVisible('multibutton');
  const mbSide = useApp((s) => s.config.widgets.multibutton.position);
  const videoSide = useApp((s) => s.config.widgets.video.position);
  const proofSide = useApp((s) => s.config.widgets.socialProof.position);
  const cbVisible = useWidgetVisible('callback');
  const chatVisible = useWidgetVisible('chat');
  const quizVisible = useWidgetVisible('quiz');
  const launcherSide = mbVisible ? mbSide : 'right';

  // Escape закрывает открытую панель или окно
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (get().open || get().popup) && set({ open: null, popup: null });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // показы кнопок (по одному разу на страницу)
  const path = useApp((s) => s.sim.path);
  useEffect(() => {
    if (!mbVisible && cbVisible) track('widget_impression', 'callback');
    if (!mbVisible && chatVisible) track('widget_impression', 'chat');
  }, [path, mbVisible, cbVisible, chatVisible]);

  const launcher = mbVisible ? <MultiButton /> : <Launchers />;
  const sideItems = (side: 'left' | 'right') => (
    <>
      {launcherSide === side && launcher}
      {videoSide === side && <VideoWidget />}
      {proofSide === side && <SocialProof />}
    </>
  );

  const panel =
    open === 'callback' && cbVisible ? <CallbackPanel /> : open === 'chat' && chatVisible ? <ChatPanel /> : null;

  return (
    <div className="v125-root pointer-events-none fixed inset-0 z-[2147483000] font-sans text-ink antialiased" style={vars}>
      <Corner side="left" lift={off.left}>{sideItems('left')}</Corner>
      <Corner side="right" lift={off.right}>{sideItems('right')}</Corner>

      {panel &&
        (mobile ? (
          <div className="pointer-events-auto absolute inset-0 flex animate-rise">{panel}</div>
        ) : (
          <div
            className="pointer-events-auto absolute flex animate-rise"
            style={{
              bottom: `calc(${off[launcherSide] + 80}px + env(safe-area-inset-bottom, 0px))`,
              top: 16,
              [launcherSide]: 20,
              alignItems: 'flex-end',
            }}
          >
            {panel}
          </div>
        ))}

      {open === 'quiz' && quizVisible && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-ink/35 p-0 sm:p-6" onClick={() => set({ open: null })}>
          <div className={cx('flex max-h-full', mobile ? 'h-full w-full' : '')} onClick={(e) => e.stopPropagation()}>
            <QuizPanel />
          </div>
        </div>
      )}

      {popup && (
        <div
          className={cx('pointer-events-auto absolute inset-0 flex bg-ink/35', mobile ? 'items-end' : 'items-center justify-center p-6')}
          onClick={() => set({ popup: null })}
        >
          <div className="flex w-full justify-center" onClick={(e) => e.stopPropagation()}>
            <LeadPopup popup={popup} />
          </div>
        </div>
      )}
    </div>
  );
}
