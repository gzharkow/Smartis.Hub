"use client";

import { formatMoney, storageEventsLimitLabel } from "@/lib/quote-calc";
import { postViewTierPrice, type AutoDealerCalculatorConfig } from "@/lib/quote-calculator";
import {
  CalcRow,
  NumberField,
  ToggleField,
  TierChoiceField,
  checkboxCls,
} from "./calculator-panel-controls";

const TECH_SUPPORT_PRICE = 90_000;
const OBJECTS_PRICE = 6_000;
const SUPPORT_USERS_PRICE = 4_000;
const MEDIA_PLAN_PRICE = 3_500;

export function AutoDealerConfigPanel({
  config,
  onChange,
}: {
  config: AutoDealerCalculatorConfig;
  onChange: (next: AutoDealerCalculatorConfig) => void;
}) {
  const avitoPrice =
    config.postViewAvitoTier === "NONE" ? null : config.postViewAvitoTier === "OVER_1M" ? 50_000 : 25_000;
  const autoRuPrice =
    config.postViewAutoRuTier === "NONE"
      ? null
      : config.postViewAutoRuTier === "OVER_1M"
        ? 50_000
        : 25_000;
  const postViewOtherPrice = postViewTierPrice(config.postViewOtherEventsCount);
  const postViewOtherLimitLabel =
    postViewOtherPrice !== null ? storageEventsLimitLabel(postViewOtherPrice) : null;

  function patch(next: Partial<AutoDealerCalculatorConfig>) {
    onChange({ ...config, ...next });
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Автодилер</p>
        <p className="mt-2 text-xs text-muted">
          Техническая поддержка ПО: {formatMoney(TECH_SUPPORT_PRICE)}
        </p>
      </div>

      <div className="border-b border-border px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className={checkboxCls}
            checked={config.customCrmIntegration}
            onChange={(e) => patch({ customCrmIntegration: e.target.checked })}
          />
          Кастомная интеграция с CRM
        </label>
      </div>

      <div className="divide-y divide-border">
        <CalcRow
          label="Количество объектов (ДЦ)"
          control={
            <NumberField
              value={config.objectsCount}
              onChange={(v) => patch({ objectsCount: v })}
            />
          }
          price={formatMoney(OBJECTS_PRICE * config.objectsCount)}
          hint={`${formatMoney(OBJECTS_PRICE)} за шт.`}
        />
        <CalcRow
          label="Пользователи технической поддержки"
          control={
            <NumberField
              value={config.supportUsersCount}
              onChange={(v) => patch({ supportUsersCount: v })}
            />
          }
          price={formatMoney(SUPPORT_USERS_PRICE * config.supportUsersCount)}
          hint={`${formatMoney(SUPPORT_USERS_PRICE)} за шт.`}
        />
        <CalcRow
          label="Загрузка медиапланов"
          control={
            <ToggleField
              checked={config.mediaPlanUpload}
              onChange={(checked) => patch({ mediaPlanUpload: checked })}
            />
          }
          price={
            config.mediaPlanUpload
              ? formatMoney(MEDIA_PLAN_PRICE * config.objectsCount)
              : undefined
          }
          hint={
            config.mediaPlanUpload
              ? `${formatMoney(MEDIA_PLAN_PRICE)} за шт., кол-во = «Количество объектов (ДЦ)» (${config.objectsCount})`
              : "Количество планов равно количеству объектов"
          }
        />
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="text-sm font-semibold">Доп. решения</p>
      </div>

      <div className="divide-y divide-border">
        <CalcRow
          label="Post-View Авито классифайд"
          control={
            <TierChoiceField
              value={config.postViewAvitoTier}
              onChange={(v) => patch({ postViewAvitoTier: v })}
            />
          }
          price={avitoPrice !== null ? formatMoney(avitoPrice) : undefined}
        />
        <CalcRow
          label="Post-View Авто.ру классифайд"
          control={
            <TierChoiceField
              value={config.postViewAutoRuTier}
              onChange={(v) => patch({ postViewAutoRuTier: v })}
            />
          }
          price={autoRuPrice !== null ? formatMoney(autoRuPrice) : undefined}
        />
        <CalcRow
          label="Post-View аналитика другой медийной рекламы"
          control={
            <NumberField
              value={config.postViewOtherEventsCount}
              onChange={(v) => patch({ postViewOtherEventsCount: v })}
              placeholder="Кол-во событий"
              className="w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-right outline-none focus:border-blue-500"
            />
          }
          price={postViewOtherPrice !== null ? formatMoney(postViewOtherPrice) : undefined}
          hint={
            postViewOtherLimitLabel
              ? `Лимит хранимых событий: ${postViewOtherLimitLabel}${postViewOtherLimitLabel === "Безлимит" ? "" : " шт."}`
              : "0 — строка не попадёт в документ"
          }
        />
        <CalcRow
          label="Mindbox интеграция"
          control={
            <ToggleField
              checked={config.mindbox}
              onChange={(checked) => patch({ mindbox: checked })}
            />
          }
          price={config.mindbox ? formatMoney(50_000) : undefined}
        />
        <CalcRow
          label="CDP Конструктор сегментов"
          control={
            <ToggleField
              checked={config.cdpSegments}
              onChange={(checked) => patch({ cdpSegments: checked })}
            />
          }
          price={config.cdpSegments ? formatMoney(60_000) : undefined}
        />
        <CalcRow
          label="Коробка"
          control={
            <ToggleField checked={config.box} onChange={(checked) => patch({ box: checked })} />
          }
          price={config.box ? formatMoney(50_000) : undefined}
          hint={
            config.box
              ? "Плюс интеграционный платёж 2 500 000 ₽ отдельной строкой в итогах"
              : undefined
          }
        />
      </div>
    </div>
  );
}
