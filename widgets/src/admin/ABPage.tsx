import { Plus, Trash2 } from 'lucide-react';
import { zTest } from '../core/rules';
import { setConfig, useApp } from '../core/store';
import type { ABTest, Variant } from '../core/types';
import { pct, rng, uid } from '../core/util';
import { Badge, Button, Card, Demo, Field, Input, PageHead, Select, Textarea } from '../ui/kit';
import { useCan } from './AdminApp';

/** DEMO-результаты: детерминированные числа на тест, чтобы показать отчёт и расчёт значимости. */
function demoResults(t: ABTest) {
  const r = rng([...t.id].reduce((a, c) => a + c.charCodeAt(0), 0));
  return t.variants.map((v, i) => {
    const n = Math.round(900 + r() * 400);
    const base = 0.052;
    const cr = base * (1 + (i ? 0.18 + r() * 0.2 : 0));
    return { id: v.id, n, conv: Math.round(n * cr) };
  });
}

export function ABPage() {
  const tests = useApp((s) => s.config.abTests);
  const events = useApp((s) => s.events);
  const can = useCan('ab');
  const upd = (id: string, p: Partial<ABTest>) => setConfig((c) => ({ ...c, abTests: c.abTests.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const updV = (t: ABTest, vid: string, p: Partial<Variant>) => upd(t.id, { variants: t.variants.map((v) => (v.id === vid ? { ...v, ...p } : v)) });

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="A/B-тесты" sub="Сравнение вариантов текстов. Посетитель закрепляется за вариантом и видит его при повторных визитах." />
      {tests.map((t) => {
        const res = demoResults(t);
        const ctl = res[0];
        const live = (vid: string) => events.filter((e) => e.name === 'widget_impression' && e.data?.variant === vid).length;
        const weights = t.variants.reduce((a, v) => a + v.weight, 0);
        return (
          <Card
            key={t.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {t.name}
                <Badge tone={t.status === 'running' ? 'ok' : t.status === 'draft' ? 'neutral' : 'warn'}>{{ running: 'идёт', draft: 'черновик', stopped: 'остановлен' }[t.status]}</Badge>
              </span>
            }
            actions={
              <fieldset disabled={!can} className="flex gap-2">
                {t.status !== 'running' && <Button size="sm" onClick={() => upd(t.id, { status: 'running' })}>Запустить</Button>}
                {t.status === 'running' && <Button size="sm" variant="outline" onClick={() => upd(t.id, { status: 'stopped' })}>Остановить</Button>}
              </fieldset>
            }
          >
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-left text-xs text-ink-mute">
                    <tr>
                      <th className="py-2 font-semibold">Вариант</th>
                      <th className="py-2 font-semibold">Показы</th>
                      <th className="py-2 font-semibold">Заявки</th>
                      <th className="py-2 font-semibold">Конверсия</th>
                      <th className="py-2 font-semibold">К контролю</th>
                      <th className="py-2 font-semibold">p-value</th>
                      <th className="py-2 font-semibold">Показы сейчас</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {t.variants.map((v, i) => {
                      const r = res[i];
                      const z = i ? zTest(ctl.conv, ctl.n, r.conv, r.n) : null;
                      return (
                        <tr key={v.id} className="border-t border-paper-line">
                          <td className="py-2 font-semibold">{v.name}</td>
                          <td className="py-2">{r.n}</td>
                          <td className="py-2">{r.conv}</td>
                          <td className="py-2">{pct(r.conv / r.n, 2)}</td>
                          <td className="py-2">{i ? `${(((r.conv / r.n) / (ctl.conv / ctl.n) - 1) * 100).toFixed(1).replace('.', ',')}%` : '-'}</td>
                          <td className="py-2">
                            {z ? (
                              <span className={z.p < 0.05 ? 'font-bold text-ok' : 'text-ink-soft'}>
                                {z.p.toFixed(3).replace('.', ',')} {z.p < 0.05 ? '· значимо' : '· мало данных'}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-2">{live(v.id)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-ink-mute">
                  Показы/заявки/конверсия - <Demo /> числа для демонстрации отчёта. «Показы сейчас» - реальные показы в этом прототипе. Значимость: двусторонний z-тест долей, порог 0,05. Цель теста: {t.goal === 'submit' ? 'отправка заявки' : 'открытие'}.
                </p>
              </div>
              <fieldset disabled={!can} className="grid gap-3 lg:grid-cols-2">
                {t.variants.map((v) => (
                  <div key={v.id} className="flex flex-col gap-2 rounded-xl border border-paper-line p-3">
                    <div className="grid grid-cols-[1fr_90px_auto] items-end gap-2">
                      <Field label="Вариант"><Input value={v.name} onChange={(e) => updV(t, v.id, { name: e.target.value })} /></Field>
                      <Field label={`Трафик ${weights ? Math.round((v.weight / weights) * 100) : 0}%`}><Input type="number" min={0} max={100} value={v.weight} onChange={(e) => updV(t, v.id, { weight: Number(e.target.value) })} /></Field>
                      {t.variants.length > 2 && (
                        <button onClick={() => upd(t.id, { variants: t.variants.filter((x) => x.id !== v.id) })} className="mb-2 rounded p-1 text-ink-mute hover:text-bad" aria-label="Удалить вариант">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Field label="Заголовок"><Input value={v.title} onChange={(e) => updV(t, v.id, { title: e.target.value })} /></Field>
                    <Field label="Текст"><Textarea value={v.text} onChange={(e) => updV(t, v.id, { text: e.target.value })} /></Field>
                    <Field label="Кнопка"><Input value={v.button} onChange={(e) => updV(t, v.id, { button: e.target.value })} /></Field>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  className="self-start"
                  onClick={() => {
                    const last = t.variants[t.variants.length - 1];
                    upd(t.id, { variants: [...t.variants, { ...last, id: String.fromCharCode(65 + t.variants.length), name: String.fromCharCode(65 + t.variants.length), weight: 0 }] });
                  }}
                >
                  <Plus className="h-4 w-4" /> Вариант
                </Button>
              </fieldset>
            </div>
          </Card>
        );
      })}
      <NewTest disabled={!can} />
    </div>
  );
}

function NewTest({ disabled }: { disabled: boolean }) {
  const scenarios = useApp((s) => s.config.widgets.leadPopup.scenarios);
  return (
    <fieldset disabled={disabled} className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-paper-line p-4">
      <Field label="Новый тест для окна">
        <Select id="new-ab-target" options={scenarios.map((s) => ({ value: s.id, label: s.name }))} defaultValue={scenarios[0]?.id} />
      </Field>
      <Button
        variant="outline"
        onClick={() => {
          const el = document.getElementById('new-ab-target') as HTMLSelectElement | null;
          const sc = scenarios.find((s) => s.id === el?.value);
          if (!sc) return;
          const id = uid('ab-');
          const base = { title: sc.title, text: sc.text, button: sc.button };
          setConfig((c) => ({
            ...c,
            abTests: [...c.abTests, { id, name: `Тест: ${sc.name}`, target: 'leadPopup', targetRef: sc.id, status: 'draft', goal: 'submit', variants: [{ id: 'A', name: 'A (контроль)', weight: 50, ...base }, { id: 'B', name: 'B', weight: 50, ...base }] }],
            widgets: { ...c.widgets, leadPopup: { ...c.widgets.leadPopup, scenarios: c.widgets.leadPopup.scenarios.map((s) => (s.id === sc.id ? { ...s, abTestId: id } : s)) } },
          }));
        }}
      >
        <Plus className="h-4 w-4" /> Создать тест
      </Button>
    </fieldset>
  );
}
