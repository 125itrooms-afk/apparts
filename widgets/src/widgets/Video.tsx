import { Maximize2, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { track } from '../core/analytics';
import { bookingUrl } from '../core/integrations';
import { markShown, navigate, useApp } from '../core/store';
import { cx } from '../core/util';
import { useIsMobile, useWidgetVisible } from './shared';
import { demoTour, demoTourWebm } from '@demo-assets';

const SIZES = { s: [96, 128], m: [120, 160], l: [150, 200] } as const;

export function VideoWidget() {
  const visible = useWidgetVisible('video');
  const cfg = useApp((s) => s.config.widgets.video);
  const closed = useApp((s) => !!s.visitor.shown['video:closed']);
  const panelOpen = useApp((s) => !!s.open || !!s.popup);
  const mobile = useIsMobile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible || closed) return setReady(false);
    const t = window.setTimeout(() => {
      setReady(true);
      track('widget_impression', 'video');
    }, cfg.delaySec * 1000);
    return () => clearTimeout(t);
  }, [visible, closed, cfg.delaySec]);

  if (!ready || (mobile && panelOpen) || !(cfg.src || demoTour)) return null;
  return <VideoBubble compact={mobile && cfg.mobile === 'compact'} />;
}

export function VideoBubble({ compact, preview }: { compact?: boolean; preview?: boolean }) {
  const cfg = useApp((s) => s.config.widgets.video);
  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted] = useState(true);
  const ref = useRef<HTMLVideoElement>(null);
  const [w, h]: readonly number[] = compact ? [84, 112] : SIZES[cfg.size];

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  const expand = () => {
    if (preview) return setExpanded(true);
    setExpanded(true);
    setMuted(false);
    track('widget_open', 'video');
  };
  const close = () => {
    if (preview) return setExpanded(false);
    markShown('video:closed');
  };

  return (
    <div
      className={cx('group pointer-events-auto relative overflow-hidden bg-ink shadow-float transition-all duration-300', expanded ? 'rounded-2xl' : 'rounded-[22px] ring-2 ring-white')}
      style={expanded ? { width: 280, height: 420 } : { width: w, height: h }}
    >
      <video ref={ref} key={cfg.src || 'demo'} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full cursor-pointer object-cover" onClick={() => (expanded ? setMuted(!muted) : expand())} aria-label={cfg.title}>
        {cfg.src ? (
          <source src={cfg.src} />
        ) : (
          <>
            {demoTourWebm && <source src={demoTourWebm} type="video/webm" />}
            <source src={demoTour} type="video/mp4" />
          </>
        )}
      </video>
      <button onClick={close} className="absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white hover:bg-black/70" aria-label="Закрыть видео">
        <X className="h-3.5 w-3.5" />
      </button>
      {!cfg.src && <span className="absolute left-1.5 top-1.5 rounded bg-black/50 px-1 text-[8px] font-bold uppercase tracking-wider text-white">demo</span>}
      {!expanded ? (
        <button onClick={expand} className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent pb-2 pt-6 text-[10px] font-semibold text-white" aria-label="Открыть видео со звуком">
          <Maximize2 className="h-3 w-3" /> Смотреть
        </button>
      ) : (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 pt-10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold leading-tight text-white">{cfg.title}</p>
            <button onClick={() => setMuted(!muted)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-white" aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={() => {
              if (preview) return;
              navigate('/apartments');
              setExpanded(false);
            }}
            className="h-10 rounded-xl bg-white text-sm font-bold text-ink"
          >
            {cfg.ctaPrimary}
          </button>
          <a href={bookingUrl()} target="_blank" rel="noreferrer" onClick={() => !preview && track('booking_click', 'video')} className="grid h-10 place-items-center rounded-xl bg-brand text-sm font-bold text-brand-ink">
            {cfg.ctaSecondary} ↗
          </a>
        </div>
      )}
    </div>
  );
}
