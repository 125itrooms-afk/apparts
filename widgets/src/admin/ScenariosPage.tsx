import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { TRIGGER_LABEL } from '../core/rules';
import { patchWidget, useApp } from '../core/store';
import type { Scenario, Segment, SegmentConditionType, TriggerType } from '../core/types';
import { uid } from '../core/util';
import { Badge, Button, Card, Field, Input, PageHead, Segmented, Select, Textarea, Toggle } from '../ui/kit';
import { useCan } from './AdminApp';

const COND_LABEL: Record<SegmentConditionType, string> = {
  utm_source: 'utm_source содержит',
  utm_campaign: 'utm_campaign содержит',
  referrer: 'Переход с сайта (referrer) содержит',
  returning: 'Повторный посетитель',
  url: 'Текущая страница начинается с',
  action: 'Совершил действие',
};

export function ScenariosPage() {
  const [tab, setTab] = useState<'popup' | 'seg'>('popup');
  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="Сценарии"
        sub="Правила показа окон генератора заявок и персонализации. Все условия внутри правила должны выполниться. Меньший приоритет - важнее."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'popup', label: 'Генератор заявок' }, { value: 'seg', label: 'Сегменты' }]} />}
      />
      {tab === 'popup' ? <PopupScenarios /> : <Segments />}
    </div>
  );
}

function PopupScenarios() {
  const cfg = useApp((s) => s.config.widgets.leadPopup);
  const tests = useApp((s) => s.config.abTests.filter((t) => t.target === 'leadPopup'));
  const can = useCan('scenarios');
  const setList = (scenarios: Scenario[]) => patchWidget('leadPopup', { scenarios });
  const upd = (id: string, p: Partial<Scenario>) => setList(cfg.scenarios.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <fieldset disabled={!can} className="flex flex-col gap-3">
      <p className="rounded-xl bg-paper-sunk px-4 py-2 text-xs text-ink-soft">
        Общие ограничения: не раньше {cfg.minSecondsOnSite} сек на сайте, не больше {cfg.maxPerSession} окна за визит, после отправки заявки окна не показываются. Меняется в «Виджеты» → «Генератор заявок».
      </p>
      {[...cfg.scenarios]
        .sort((a, b) => a.priority - b.priority)
        .map((sc) => (
          <Card
            key={sc.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {sc.name} <Badge>приоритет {sc.priority}</Badge> {sc.abTestId && <Badge tone="info">A/B</Badge>}
              </span>
            }
            actions={
              <div className="flex items-center gap-2">
                <Toggle checked={sc.enabled} onChange={(v) => upd(sc.id, { enabled: v })} />
                <button type="button" onClick={() => setList(cfg.scenarios.filter((x) => x.id !== sc.id))} className="rounded p-1 text-ink-mute hover:text-bad" aria-label="Удалить сценарий">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <Field label="Название"><Input value={sc.name} onChange={(e) => upd(sc.id, { name: e.target.value })} /></Field>
                  <Field label="Приоритет"><Input type="number" value={sc.priority} onChange={(e) => upd(sc.id, { priority: Number(e.target.value) })} /></Field>
                </div>
                <p className="text-xs font-semibold text-ink-soft">Условия (И)</p>
                {sc.triggers.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                    <Select
                      value={t.type}
                      onChange={(e) => upd(sc.id, { triggers: sc.triggers.map((x, j) => (j === i ? { ...x, type: e.target.value as TriggerType } : x)) })}
                      options={(Object.keys(TRIGGER_LABEL) as TriggerType[]).map((k) => ({ value: k, label: TRIGGER_LABEL[k] }))}
                    />
                    <Input value={t.value} disabled={t.type === 'exit'} placeholder={t.type === 'exit' ? '-' : 'значение'} onChange={(e) => upd(sc.id, { triggers: sc.triggers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                    <button type="button" onClick={() => upd(sc.id, { triggers: sc.triggers.filter((_, j) => j !== i) })} className="rounded p-2 text-ink-mute hover:text-bad" aria-label="Удалить условие">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => upd(sc.id, { triggers: [...sc.triggers, { type: 'time', value: '20' }] })}>
                  <Plus className="h-3.5 w-3.5" /> Условие
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Не чаще, чем раз в (часов)"><Input type="number" min={1} value={sc.capHours} onChange={(e) => upd(sc.id, { capHours: Number(e.target.value) || 1 })} /></Field>
                  <Field label="A/B-тест">
                    <Select value={sc.abTestId ?? ''} onChange={(e) => upd(sc.id, { abTestId: e.target.value || undefined })} options={[{ value: '', label: 'Нет' }, ...tests.map((t) => ({ value: t.id, label: t.name }))]} />
                  </Field>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Field label="Заголовок"><Input value={sc.title} onChange={(e) => upd(sc.id, { title: e.target.value })} /></Field>
                <Field label="Текст"><Textarea value={sc.text} onChange={(e) => upd(sc.id, { text: e.target.value })} /></Field>
                <Field label="Кнопка"><Input value={sc.button} onChange={(e) => upd(sc.id, { button: e.target.value })} /></Field>
                {sc.abTestId && <p className="text-[11px] text-ink-mute">Пока тест запущен, тексты берутся из вариантов теста.</p>}
              </div>
            </div>
          </Card>
        ))}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() =>
          setList([
            ...cfg.scenarios,
            { id: uid('sc-'), name: 'Новый сценарий', enabled: false, priority: 50, triggers: [{ type: 'time', value: '30' }], title: 'Заголовок', text: 'Текст предложения', button: 'Оставить заявку', capHours: 24 },
          ])
        }
      >
        <Plus className="h-4 w-4" /> Добавить сценарий
      </Button>
    </fieldset>
  );
}

function Segments() {
  const p = useApp((s) => s.config.widgets.personalization);
  const tests = useApp((s) => s.config.abTests.filter((t) => t.target === 'personalization'));
  const can = useCan('scenarios');
  const setList = (segments: Segment[]) => patchWidget('personalization', { segments });
  const upd = (id: string, patch: Partial<Segment>) => setList(p.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <fieldset disabled={!can} className="flex flex-col gap-3">
      <p className="rounded-xl bg-paper-sunk px-4 py-2 text-xs text-ink-soft">
        Посетитель получает тексты первого подходящего сегмента (по приоритету). Проверить: «Сайт гостя» → симулятор → выберите источник трафика или повторный визит.
      </p>
      {[...p.segments]
        .sort((a, b) => a.priority - b.priority)
        .map((sg) => (
          <Card
            key={sg.id}
            title={
              <span className="flex items-center gap-2">
                {sg.name} <Badge>приоритет {sg.priority}</Badge>
              </span>
            }
            actions={
              <div className="flex items-center gap-2">
                <Toggle checked={sg.enabled} onChange={(v) => upd(sg.id, { enabled: v })} />
                <button type="button" onClick={() => setList(p.segments.filter((x) => x.id !== sg.id))} className="rounded p-1 text-ink-mute hover:text-bad" aria-label="Удалить сегмент">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <Field label="Название"><Input value={sg.name} onChange={(e) => upd(sg.id, { name: e.target.value })} /></Field>
                  <Field label="Приоритет"><Input type="number" value={sg.priority} onChange={(e) => upd(sg.id, { priority: Number(e.target.value) })} /></Field>
                </div>
                {sg.conditions.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                    <Select
                      value={c.type}
                      onChange={(e) => upd(sg.id, { conditions: sg.conditions.map((x, j) => (j === i ? { ...x, type: e.target.value as SegmentConditionType } : x)) })}
                      options={(Object.keys(COND_LABEL) as SegmentConditionType[]).map((k) => ({ value: k, label: COND_LABEL[k] }))}
                    />
                    <Input value={c.value} disabled={c.type === 'returning'} onChange={(e) => upd(sg.id, { conditions: sg.conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                    <button type="button" onClick={() => upd(sg.id, { conditions: sg.conditions.filter((_, j) => j !== i) })} className="rounded p-2 text-ink-mute hover:text-bad" aria-label="Удалить условие">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => upd(sg.id, { conditions: [...sg.conditions, { type: 'utm_campaign', value: '' }] })}>
                  <Plus className="h-3.5 w-3.5" /> Условие
                </Button>
                <Field label="A/B-тест">
                  <Select value={sg.abTestId ?? ''} onChange={(e) => upd(sg.id, { abTestId: e.target.value || undefined })} options={[{ value: '', label: 'Нет' }, ...tests.map((t) => ({ value: t.id, label: t.name }))]} />
                </Field>
              </div>
              <div className="flex flex-col gap-3">
                <Field label="Заголовок"><Input value={sg.headline} onChange={(e) => upd(sg.id, { headline: e.target.value })} /></Field>
                <Field label="Подзаголовок"><Textarea value={sg.subline} onChange={(e) => upd(sg.id, { subline: e.target.value })} /></Field>
                <Field label="Кнопка"><Input value={sg.cta} onChange={(e) => upd(sg.id, { cta: e.target.value })} /></Field>
              </div>
            </div>
          </Card>
        ))}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => setList([...p.segments, { id: uid('seg-'), name: 'Новый сегмент', priority: 60, enabled: false, conditions: [{ type: 'utm_campaign', value: '' }], headline: p.defaultHeadline, subline: p.defaultSubline, cta: p.defaultCta }])}
      >
        <Plus className="h-4 w-4" /> Добавить сегмент
      </Button>
    </fieldset>
  );
}
