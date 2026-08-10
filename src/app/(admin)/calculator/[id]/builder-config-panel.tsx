"use client";

import { formatMoney, storageEventsLimitLabel } from "@/lib/quote-calc";
import { postViewVolumeTierPrice, type BuilderCalculatorConfig } from "@/lib/quote-calculator";
import {
  CalcRow,
  NumberField,
  ToggleField,
  VolumeTierField,
  checkboxCls,
} from "./calculator-panel-controls";

export function BuilderConfigPanel({
  config,
  onChange,
}: {
  config: BuilderCalculatorConfig;
  onChange: (next: BuilderCalculatorConfig) => void;
}) {
  const techSupportPrice = config.enterpriseLicense ? 120_000 : 90_000;
  const objectsPrice = config.enterpriseLicense ? 15_000 : 12_000;
  const supportUsersPrice = config.enterpriseLicense ? 4_000 : 3_500;
  const mediaPlanPrice = config.enterpriseLicense ? 5_000 : 4_500;
  const postViewPrice = postViewVolumeTierPrice(config.postViewEventsTier);
  const postViewLimitLabel = postViewPrice !== null ? storageEventsLimitLabel(postViewPrice) : null;

  function patch(next: Partial<BuilderCalculatorConfig>) {
    onChange({ ...config, ...next });
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Застройщик</p>
        <p className="mt-2 text-xs text-muted">
          Техническая поддержка ПО: {formatMoney(techSupportPrice)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 border-b border-border px-4 py-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className={checkboxCls}
            checked={config.enterpriseLicense}
            onChange={(e) => patch({ enterpriseLicense: e.target.checked })}
          />
          Enterprise лицензия
        </label>
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
          label="Количество объектов"
          control={
            <NumberField
              value={config.objectsCount}
              onChange={(v) => patch({ objectsCount: v })}
            />
          }
          price={formatMoney(objectsPrice * config.objectsCount)}
          hint={`${formatMoney(objectsPrice)} за шт.`}
        />
        <CalcRow
          label="Пользователи технической поддержки"
          control={
            <NumberField
              value={config.supportUsersCount}
              onChange={(v) => patch({ supportUsersCount: v })}
            />
          }
          price={formatMoney(supportUsersPrice * config.supportUsersCount)}
          hint={`${formatMoney(supportUsersPrice)} за шт.`}
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
              ? formatMoney(mediaPlanPrice * config.objectsCount)
              : undefined
          }
          hint={
            config.mediaPlanUpload
              ? `${formatMoney(mediaPlanPrice)} за шт., кол-во = «Количество объектов» (${config.objectsCount})`
              : "Количество планов равно количеству объектов"
          }
        />
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="text-sm font-semibold">Доп. решения</p>
      </div>

      <div className="divide-y divide-border">
        <CalcRow
          label="Post-View аналитика медийной рекламы"
          control={
            <VolumeTierField
              value={config.postViewEventsTier}
              onChange={(v) => patch({ postViewEventsTier: v })}
            />
          }
          price={postViewPrice !== null ? formatMoney(postViewPrice) : undefined}
          hint={
            postViewLimitLabel
              ? `Лимит хранимых событий: ${postViewLimitLabel}${postViewLimitLabel === "Безлимит" ? "" : " шт."}`
              : "Не выбрано — строка не попадёт в документ"
          }
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
          label="Антифрод"
          control={
            <ToggleField
              checked={config.antifraud}
              onChange={(checked) => patch({ antifraud: checked })}
            />
          }
          price={config.antifraud ? formatMoney(36_000) : undefined}
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
