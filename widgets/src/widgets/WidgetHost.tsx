import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { track } from '../core/analytics';
import { abVariant, pickScenario, type BehaviorCtx } from '../core/rules';
import { get, markShown, set, useApp } from '../core/store';
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
  return { ['--v125-brand' as string]: hexToRgbTriplet(b.brand), ['--v125-brand-ink' as string]: hexToRgbTriplet(b.brandInk) };
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

function Corner({ side, children }: { side: 'left' | 'right'; children: ReactNode }) {
  return (
    <div
      className={cx('pointer-events-none absolute flex flex-col-reverse gap-3', side === 'left' ? 'items-start' : 'items-end')}
      style={{
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        [side]: `calc(20px + env(safe-area-inset-${side}, 0px))`,
      }}
    >
      {children}
    </div>
  );
}

export function WidgetHost() {
  useBehaviorEngine();
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
      <Corner side="left">{sideItems('left')}</Corner>
      <Corner side="right">{sideItems('right')}</Corner>

      {panel &&
        (mobile ? (
          <div className="pointer-events-auto absolute inset-0 flex animate-rise">{panel}</div>
        ) : (
          <div
            className="pointer-events-auto absolute flex animate-rise"
            style={{
              bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
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
