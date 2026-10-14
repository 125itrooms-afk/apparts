import { CheckCircle2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { track, trackFormStart } from '../core/analytics';
import { submitLead } from '../core/leads';
import { set, useApp, type PopupState } from '../core/store';
import { cx, isValidPhone } from '../core/util';
import { Consent, Honeypot, PhoneInput, useIsMobile } from './shared';
import { demoInterior as interior } from '@demo-assets';

export function LeadPopup({ popup, preview }: { popup: PopupState; preview?: boolean }) {
  const mobile = useIsMobile();
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const openedAt = useRef(Date.now());
  const image = useApp((s) => s.config.widgets.leadPopup.image);

  const close = () => {
    if (preview) return;
    track('popup_close', 'leadPopup', { scenario: popup.scenarioId });
    set({ popup: null });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (preview) return setError('Предпросмотр: заявки не создаются.');
    if (!isValidPhone(phone)) return setError('Введите номер полностью: +7 (9XX) XXX-XX-XX');
    const res = submitLead({
      source: 'leadPopup',
      phone,
      consent,
      website: hp,
      openedAt: openedAt.current,
      comment: `Сценарий: ${popup.title}${popup.variantId ? ` (вариант ${popup.variantId})` : ''}`,
    });
    if (!res.ok) return setError(res.error);
    setDone(res.lead.num);
  };

  return (
    <div
      className={cx(
        'relative flex overflow-hidden bg-white text-ink shadow-float animate-pop',
        mobile && !preview ? 'w-full rounded-t-3xl' : 'w-[640px] max-w-full rounded-3xl',
      )}
      role="dialog"
      aria-label={popup.title}
    >
      {!mobile && (image || interior) && (
        <div className="relative w-[40%] shrink-0">
          <img src={image || interior} alt={image ? '' : 'Иллюстрация интерьера (DEMO)'} className="absolute inset-0 h-full w-full object-cover" />
          {!image && <span className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">иллюстрация · demo</span>}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-6">
        <button onClick={close} className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-mute hover:bg-paper-sunk" aria-label="Закрыть">
          <X className="h-5 w-5" />
        </button>
        {done ? (
          <div className="flex flex-col items-start gap-2 py-6 animate-rise">
            <CheckCircle2 className="h-10 w-10 text-ok" />
            <p className="text-lg font-bold">Спасибо! Заявка №{done} принята</p>
            <p className="text-sm text-ink-soft">Специалист по бронированию свяжется с вами и поможет с выбором.</p>
          </div>
        ) : (
          <>
            <h2 className="pr-8 font-display text-[26px] leading-tight text-ink">{popup.title}</h2>
            <p className="text-sm text-ink-soft">{popup.text}</p>
            <form onSubmit={submit} onChange={() => trackFormStart('leadPopup')} className="relative mt-1 flex flex-col gap-2.5">
              <Honeypot value={hp} onChange={setHp} />
              <PhoneInput value={phone} onChange={setPhone} />
              <Consent checked={consent} onChange={setConsent} />
              {error && <p className="text-xs font-semibold text-bad" role="alert">{error}</p>}
              <button type="submit" className="h-12 rounded-xl bg-brand font-bold text-brand-ink hover:brightness-110">
                {popup.button}
              </button>
            </form>
            {popup.variantId && <p className="text-[10px] text-ink-mute">A/B: вариант {popup.variantId}</p>}
          </>
        )}
      </div>
    </div>
  );
}
