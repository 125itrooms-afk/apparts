import { useRef, useState } from 'react';
import { cx } from '../core/util';

/** Цвета серий (категориальная палитра, слоты 1-3 - проходят проверку различимости) */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];

export interface Series {
  name: string;
  color: string;
  values: number[];
}

/** Линейный график с областью, сеткой и подсказкой по наведению. Одна ось Y. */
export function LineChart({ labels, series, height = 220, format = (v: number) => String(Math.round(v)) }: { labels: string[]; series: Series[]; height?: number; format?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const W = 640;
  const H = height;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = niceMax(max);
  const x = (i: number) => pad.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * nice);
  const step = Math.max(1, Math.ceil(labels.length / 6));

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (labels.length - 1));
    setHover(Math.max(0, Math.min(labels.length - 1, i)));
  };

  return (
    <div className="relative">
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-soft">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={series.map((s) => s.name).join(', ')}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e1e4de" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#7a7f87">
              {format(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % step === 0 ? (
            <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#7a7f87">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
          return (
            <g key={s.name}>
              {si === 0 && <path d={`${d} L${x(s.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={s.color} opacity={0.08} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              <circle cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1] ?? 0)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#23262b" strokeOpacity={0.25} />
            {series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-6 z-10 rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-float"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${x(hover) / W > 0.6 ? '-105%' : '8px'})` }}
        >
          <p className="mb-1 font-semibold">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-1.5 tabular-nums">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}: <b>{format(s.values[hover])}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Горизонтальные столбцы с подписями значений */
export function BarList({ rows, format = (v: number) => String(v), color = SERIES[0] }: { rows: { label: string; value: number; sub?: string }[]; format?: (v: number) => string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="group" title={`${r.label}: ${format(r.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium text-ink">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink-soft">
              <b className="text-ink">{format(r.value)}</b>
              {r.sub && <span className="ml-1.5">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-paper-sunk">
            <div className="h-full rounded-full transition-all group-hover:brightness-110" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Воронка: шаги с абсолютом и конверсией от предыдущего */
export function Funnel({ steps }: { steps: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : 0;
        return (
          <li key={s.label} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-xs">
            <span className="truncate font-medium text-ink">{s.label}</span>
            <div className="h-6 rounded-md bg-paper-sunk">
              <div className={cx('flex h-full items-center rounded-md px-2 text-[11px] font-semibold text-white')} style={{ width: `${Math.max(3, (s.value / max) * 100)}%`, background: SERIES[0], opacity: 1 - i * 0.12 }}>
                {s.value / max > 0.18 && s.value.toLocaleString('ru-RU')}
              </div>
            </div>
            <span className="w-14 text-right tabular-nums text-ink-soft">{i ? `${((s.value / (prev || 1)) * 100).toFixed(1).replace('.', ',')}%` : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Spark({ values, color = SERIES[0] }: { values: number[]; color?: string }) {
  const W = 100;
  const H = 28;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * W},${H - 2 - (v / max) * (H - 4)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,${H} ${pts.join(' ')} ${W},${H}`} fill={color} opacity={0.1} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
