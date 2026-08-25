"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "../VedShell";
import { EventsTimeline } from "../EventsTimeline";
import { BrokerClientFeedback } from "./BrokerClientFeedback";
import { BrokerSimilarPrecedents } from "./BrokerSimilarPrecedents";
import { BrokerDossierPane } from "./BrokerDossierPane";
import { HsCodeAutocomplete } from "../HsCodeAutocomplete";
import { TnvedCardDrawer } from "../TnvedCardDrawer";
import { applyTnvedRowHint, type Calc, type MapRow } from "./types";
import { FactorySkuSnapshot } from "./FactorySkuSnapshot";
import { BrokerAttrsFill } from "./BrokerAttrsFill";
import { LandedWithoutFreightCard } from "../LandedWithoutFreightCard";
import { formatRub } from "../lbm-pane-visual";

export function WorkMapping({
  selected,
  mapRows,
  hsEdit,
  feeEdit,
  extraFeeEdit,
  extraFeeNote,
  comment,
  reclassifyNote,
  busy,
  onHsEdit,
  onFeeEdit,
  onExtraFeeEdit,
  onExtraFeeNote,
  onComment,
  onReclassifyNote,
  onUpdateRow,
  onSaveDraft,
  onApprove,
  onClaim,
  onEscalate,
  onReclassify,
  llmReclassifyEnabled = true,
  confidenceThreshold = 0.75,
  dossierThin = false,
  onRequestDossier,
}: {
  selected: Calc | null;
  mapRows: MapRow[];
  hsEdit: string;
  feeEdit: number;
  extraFeeEdit: number;
  extraFeeNote: string;
  comment: string;
  reclassifyNote: string;
  busy: boolean;
  onHsEdit: (v: string) => void;
  onFeeEdit: (v: number) => void;
  onExtraFeeEdit: (v: number) => void;
  onExtraFeeNote: (v: string) => void;
  onComment: (v: string) => void;
  onReclassifyNote: (v: string) => void;
  onUpdateRow: (id: string, patch: Partial<MapRow>) => void;
  onSaveDraft: () => void;
  onApprove: () => void;
  onClaim: () => void;
  onEscalate?: () => void;
  onReclassify?: () => void;
  /** Platform gate — hide reclassify when LLM enrich off (D27 / Vercel). */
  llmReclassifyEnabled?: boolean;
  confidenceThreshold?: number;
  dossierThin?: boolean;
  onRequestDossier?: (message: string) => Promise<void>;
}) {
  const [approvePreview, setApprovePreview] = useState(false);
  const [cardCode, setCardCode] = useState<string | null>(null);
  useEffect(() => {
    setApprovePreview(false);
  }, [selected?.id]);
  if (!selected) {
    return (
      <div className="card">
        <h3>Карточка</h3>
        <p className="text-sm text-[#7a7f89]">Выберите заявку</p>
      </div>
    );
  }

  const emptyItems = mapRows.length === 0;
  const extraFeeMissing = extraFeeEdit > 0 && !extraFeeNote.trim();

  return (
    <div className="card">
      <h3>Карточка {selected.number}</h3>
      <div className="space-y-3 text-sm">
        <div className="font-medium">{selected.title}</div>
        <div className="metric-row">
          <div className="metric">
            <div className="k">ТН ВЭД (AI)</div>
            <div className="v" style={{ fontSize: "1rem" }}>
              {selected.hsCode || "—"}
            </div>
          </div>
          <div className="metric">
            <div className="k">Уверенность</div>
            <div className="v" style={{ fontSize: "1.2rem" }}>
              {selected.confidence != null ? `${Math.round(selected.confidence * 100)}%` : "—"}
            </div>
          </div>
        </div>
        <div className="breakdown">
          <div>
            <span>Пошлина</span>
            <strong>{formatRub(selected.dutyRub ?? 0)}</strong>
          </div>
          <div>
            <span>НДС 22%</span>
            <strong>{formatRub(selected.vatRub ?? 0)}</strong>
          </div>
          <div>
            <span>Сбор ПП 1637</span>
            <strong>{formatRub(selected.feeRub ?? 0)}</strong>
          </div>
          <div>
            <span>Итого</span>
            <strong>{formatRub(selected.totalPaymentsRub ?? 0)}</strong>
          </div>
        </div>
        {(selected.description || selected.country || selected.shipmentValue) && (
          <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-[#0f172a]">
            {selected.description && (
              <>
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#7a7f89]">
                  Описание клиента
                </p>
                <p className="whitespace-pre-wrap text-sm">{selected.description}</p>
              </>
            )}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[#7a7f89]">
              {selected.country && <span>Страна: {selected.country}</span>}
              {selected.shipmentValue && <span>Партия: {selected.shipmentValue}</span>}
            </div>
          </div>
        )}
        <div>Клиент: {selected.clientUser?.name || "—"}</div>
        <div>
          AI код: {selected.hsCode} · <StatusPill status={selected.status} />
        </div>
        <div>Платежи: {(selected.totalPaymentsRub ?? 0).toLocaleString("ru-RU")} ₽</div>
        <LandedWithoutFreightCard calc={selected} compact />
        {selected.brokerComment && (
          <div className="rounded-2xl border border-slate-100 px-3 py-2 text-xs">
            <span className="font-medium text-[#7a7f89]">Предыдущий комментарий: </span>
            {selected.brokerComment}
          </div>
        )}

        <BrokerClientFeedback calc={selected} />
        <BrokerSimilarPrecedents
          items={selected.similarPrecedents}
          aiHs={selected.hsCode}
          onPickHs={onHsEdit}
        />
        {!(selected.similarPrecedents?.length) && (
          <p className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] leading-snug text-sky-950">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700/80">Подсказка</span>
            <span className="mt-0.5 block">
              Выберите код ТН ВЭД в строке — подставятся ориентиры пошлины/НДС. Пустые attrs клиента можно
              дописать, не затирая уже заполненные.
            </span>
          </p>
        )}


        {onRequestDossier && (
          <BrokerDossierPane
            calc={selected}
            confidenceThreshold={confidenceThreshold}
            busy={busy}
            onRequest={onRequestDossier}
          />
        )}

        {mapRows.some((r) => r.mediaUrl) && (
          <div className="flex flex-wrap gap-2">
            {mapRows
              .filter((r) => r.mediaUrl)
              .map((r) => (
                <a
                  key={r.id}
                  href={r.mediaUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                  title={r.name}
                >
                  {/* dynamic upload URLs — plain img */}
                  <img src={r.mediaUrl!} alt={r.name} className="h-full w-full object-cover" />
                </a>
              ))}
          </div>
        )}

        {emptyItems ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-amber-800">
            Нет позиций CalculationItem — заявку нельзя утвердить. Пересоздайте расчёт.
          </p>
        ) : (
          <div>
            <div className="mb-1 font-medium">Таблица сопоставлений</div>
            {/* Mobile cards */}
            <ul className="space-y-3 md:hidden">
              {mapRows.map((r) => {
                const delta =
                  r.hsCodeAi && r.hsCodeFinal && r.hsCodeAi !== r.hsCodeFinal ? "≠" : "=";
                const a = r.attrs;
                const attrBits = a
                  ? [
                      a.brand && `бренд: ${a.brand}`,
                      a.material && `мат.: ${a.material}`,
                      a.originCountry && `origin: ${a.originCountry}`,
                      a.netWeightKg != null && `${a.netWeightKg} кг`,
                      a.hsHint && `hint: ${a.hsHint}`,
                    ].filter(Boolean)
                  : [];
                return (
                  <li key={r.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="font-medium text-[#0f172a]">{r.name}</div>
                    <label className="mt-2 block text-xs">
                      Товарное описание (для PDF)
                      <textarea
                        className="mt-0.5 w-full rounded border px-2 py-1.5"
                        rows={2}
                        value={r.description}
                        onChange={(e) => onUpdateRow(r.id, { description: e.target.value })}
                        placeholder="Уточнение номенклатуры, не слова клиента"
                      />
                    </label>
                    <div className="mt-1 text-[10px] text-[#7a7f89]">
                      {attrBits.length ? attrBits.join(" · ") : "attrs: —"}
                    </div>
                    <div className="mt-2">
                      <p className="mb-1 text-[10px] font-medium text-[#7a7f89]">
                        Дописать пустые attrs
                      </p>
                      <BrokerAttrsFill
                        attrs={r.attrs}
                        onChange={(next) => onUpdateRow(r.id, { attrs: next })}
                      />
                    </div>
                    <div className="mt-2">
                      <FactorySkuSnapshot manufacturerSkuId={r.manufacturerSkuId} attrs={r.attrs} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7a7f89]">
                      <span>AI: {r.hsCodeAi || "—"}</span>
                      <span>Δ {delta}</span>
                    </div>
                    <label className="mt-2 block text-xs">
                      Брокер HS
                      <HsCodeAutocomplete
                        className="mt-0.5 w-full rounded border px-2 py-1.5"
                        value={r.hsCodeFinal}
                        onChange={(v) => onUpdateRow(r.id, { hsCodeFinal: v })}
                        onOpenCard={setCardCode}
                        onHint={(hint) => {
                          const patch = applyTnvedRowHint(r, hint);
                          if (Object.keys(patch).length) onUpdateRow(r.id, patch);
                        }}
                      />
                    </label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <label className="block text-xs">
                        Пошлина
                        <input
                          type="number"
                          className="mt-0.5 w-full rounded border px-2 py-1.5"
                          value={r.dutyRub}
                          onChange={(e) =>
                            onUpdateRow(r.id, { dutyRub: Number(e.target.value) || 0 })
                          }
                        />
                      </label>
                      <label className="block text-xs">
                        НДС
                        <input
                          type="number"
                          className="mt-0.5 w-full rounded border px-2 py-1.5"
                          value={r.vatRub}
                          onChange={(e) =>
                            onUpdateRow(r.id, { vatRub: Number(e.target.value) || 0 })
                          }
                        />
                      </label>
                      <label className="block text-xs">
                        Цена ед.
                        <input
                          type="number"
                          className="mt-0.5 w-full rounded border px-2 py-1.5"
                          value={r.unitPrice}
                          onChange={(e) =>
                            onUpdateRow(r.id, { unitPrice: Number(e.target.value) || 0 })
                          }
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead className="text-[#7a7f89]">
                  <tr>
                    <th className="pr-1 py-1">Позиция</th>
                    <th className="pr-1 py-1">Attrs</th>
                    <th className="pr-1 py-1">AI</th>
                    <th className="pr-1 py-1">Брокер HS</th>
                    <th className="pr-1 py-1">Δ HS</th>
                    <th className="pr-1 py-1">Пошлина</th>
                    <th className="pr-1 py-1">НДС</th>
                    <th className="py-1">Цена ед.</th>
                  </tr>
                </thead>
                <tbody>
                  {mapRows.map((r) => {
                    const delta =
                      r.hsCodeAi && r.hsCodeFinal && r.hsCodeAi !== r.hsCodeFinal ? "≠" : "=";
                    return (
                      <tr key={r.id} className="border-t border-slate-100 align-top">
                        <td className="py-1 pr-1">
                          <div>{r.name}</div>
                          <textarea
                            className="mt-1 w-full min-w-[10rem] rounded border px-1 py-0.5 text-[11px]"
                            rows={2}
                            value={r.description}
                            onChange={(e) => onUpdateRow(r.id, { description: e.target.value })}
                            placeholder="Товарное описание для PDF"
                            aria-label={`Товарное описание ${r.name}`}
                          />
                        </td>
                        <td className="min-w-[14rem] max-w-[18rem] py-1 pr-1 text-[10px] text-[#7a7f89]">
                          <BrokerAttrsFill
                            attrs={r.attrs}
                            onChange={(next) => onUpdateRow(r.id, { attrs: next })}
                          />
                          <div className="mt-1">
                            <FactorySkuSnapshot manufacturerSkuId={r.manufacturerSkuId} attrs={r.attrs} />
                          </div>
                        </td>
                        <td className="py-1 pr-1">{r.hsCodeAi || "—"}</td>
                        <td className="py-1 pr-1">
                          <HsCodeAutocomplete
                            className="w-28 rounded border px-1 py-0.5"
                            value={r.hsCodeFinal}
                            onChange={(v) => onUpdateRow(r.id, { hsCodeFinal: v })}
                            onOpenCard={setCardCode}
                            onHint={(hint) => {
                              const patch = applyTnvedRowHint(r, hint);
                              if (Object.keys(patch).length) onUpdateRow(r.id, patch);
                            }}
                          />
                        </td>
                        <td className="py-1 pr-1 text-center">{delta}</td>
                        <td className="py-1 pr-1">
                          <input
                            type="number"
                            className="w-20 rounded border px-1 py-0.5"
                            value={r.dutyRub}
                            onChange={(e) =>
                              onUpdateRow(r.id, { dutyRub: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="py-1 pr-1">
                          <input
                            type="number"
                            className="w-20 rounded border px-1 py-0.5"
                            value={r.vatRub}
                            onChange={(e) =>
                              onUpdateRow(r.id, { vatRub: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="py-1">
                          <input
                            type="number"
                            className="w-20 rounded border px-1 py-0.5"
                            value={r.unitPrice}
                            onChange={(e) =>
                              onUpdateRow(r.id, { unitPrice: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-xs text-[#7a7f89]">
              Итого по таблице:{" "}
              {(
                mapRows.reduce((s, r) => s + r.dutyRub + r.vatRub, 0) +
                feeEdit +
                extraFeeEdit
              ).toLocaleString("ru-RU")}{" "}
              ₽ (сбор + прочие отдельно)
            </div>
          </div>
        )}

        <label className="block">
          Код ТН ВЭД (сводный)
          <HsCodeAutocomplete
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={hsEdit}
            onChange={onHsEdit}
            onOpenCard={setCardCode}
            onHint={(hint) => {
              if (hint.feeHintRub != null) onFeeEdit(hint.feeHintRub);
            }}
          />
        </label>
        <label className="block">
          Таможенный сбор, ₽
          <input
            type="number"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={feeEdit}
            onChange={(e) => onFeeEdit(Number(e.target.value) || 0)}
          />
        </label>
        <label className="block">
          Прочие сборы, ₽
          <input
            type="number"
            className={`mt-1 w-full rounded-xl border px-3 py-2 ${
              extraFeeMissing ? "border-amber-400" : ""
            }`}
            value={extraFeeEdit}
            onChange={(e) => onExtraFeeEdit(Number(e.target.value) || 0)}
          />
        </label>
        <label className="block">
          За что прочие сборы
          <input
            type="text"
            className={`mt-1 w-full rounded-xl border px-3 py-2 ${
              extraFeeMissing ? "border-amber-400" : ""
            }`}
            value={extraFeeNote}
            onChange={(e) => onExtraFeeNote(e.target.value)}
            placeholder="Напр.: особый выпуск, досмотр"
            disabled={extraFeeEdit <= 0}
          />
        </label>
        {extraFeeMissing && (
          <p className="text-xs text-amber-800">Если сумма прочих сборов больше 0 — укажите основание.</p>
        )}
        <label className="block">
          Комментарий
          <textarea
            className={`mt-1 w-full rounded-xl border px-3 py-2 ${
              dossierThin && !comment.trim() ? "border-amber-400" : ""
            }`}
            rows={2}
            value={comment}
            onChange={(e) => onComment(e.target.value)}
            placeholder={
              dossierThin
                ? "Обязательно: на чём основан код при неполных данных"
                : undefined
            }
          />
        </label>
        {dossierThin && ["IN_REVIEW", "SLA_RISK"].includes(selected.status) && (
          <p className="text-xs text-amber-800">
            Данных мало — перед PDF укажите комментарий (оговорка для клиента).
          </p>
        )}
        {onReclassify && ["IN_REVIEW", "SLA_RISK"].includes(selected.status) && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3">
            {llmReclassifyEnabled ? (
              <>
                <label className="block text-xs">
                  Переклассификация AI (комментарий брокера)
                  <textarea
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Напр.: это запчасть, не готовый ноутбук"
                    value={reclassifyNote}
                    onChange={(e) => onReclassifyNote(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || reclassifyNote.trim().length < 3 || emptyItems}
                  onClick={onReclassify}
                  className="mt-2 rounded-full border border-[#2b72f4] px-3 py-1.5 text-xs font-semibold text-[#2b72f4] disabled:opacity-40"
                >
                  Запросить новый код AI
                </button>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-[#7a7f89]">
                Переклассификация AI недоступна — LLM enrich выключен администратором или нет
                LLM-сервиса. Исправьте код вручную в таблице сопоставлений.
              </p>
            )}
          </div>
        )}
        <div>
          <div className="mb-2 font-medium">История</div>
          <EventsTimeline calculationId={selected.id} />
        </div>
        {approvePreview && (
          <div className="rounded-2xl border border-[#2b72f4]/30 bg-[#e8f0fe] px-3 py-3 text-xs text-[#0f172a]">
            <p className="font-semibold">Клиент получит в PDF</p>
            <ul className="mt-1 space-y-0.5 text-[var(--kb-muted)]">
              <li>ТН ВЭД: {hsEdit || selected.hsCodeFinal || selected.hsCode || "—"}</li>
              <li>
                Позиций: {mapRows.length} · пошлина{" "}
                {mapRows.reduce((s, r) => s + (r.dutyRub || 0), 0).toLocaleString("ru-RU")} ₽ · НДС{" "}
                {mapRows.reduce((s, r) => s + (r.vatRub || 0), 0).toLocaleString("ru-RU")} ₽
              </li>
              <li>
                Сбор: {feeEdit.toLocaleString("ru-RU")} ₽
                {extraFeeEdit > 0
                  ? ` · прочие ${extraFeeEdit.toLocaleString("ru-RU")} ₽`
                  : ""}
              </li>
              {comment.trim() ? <li>Комментарий: {comment.trim()}</li> : null}
              {dossierThin ? <li className="text-amber-800">Thin dossier — PDF с оговоркой</li> : null}
            </ul>
            <p className="mt-2 font-medium">Нажмите «Подтвердить PDF», если всё верно.</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || selected.status === "QUEUED" || emptyItems || extraFeeMissing}
            onClick={onSaveDraft}
            className="rounded-full border px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Сохранить черновик
          </button>
          <button
            type="button"
            disabled={
              busy ||
              selected.status === "QUEUED" ||
              emptyItems ||
              selected.status === "DONE" ||
              extraFeeMissing ||
              (dossierThin && !comment.trim())
            }
            onClick={() => {
              if (!approvePreview) {
                setApprovePreview(true);
                return;
              }
              setApprovePreview(false);
              onApprove();
            }}
            className="rounded-full bg-[#2b72f4] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {approvePreview ? "Подтвердить PDF" : "Утвердить и PDF"}
          </button>
          {approvePreview && (
            <button
              type="button"
              className="rounded-full border px-4 py-2 text-xs font-semibold"
              onClick={() => setApprovePreview(false)}
            >
              Отмена
            </button>
          )}
          {selected.status === "QUEUED" && (
            <button
              type="button"
              disabled={busy}
              onClick={onClaim}
              className="rounded-full border px-4 py-2 text-xs font-semibold"
            >
              Сначала взять
            </button>
          )}
          {selected.status === "IN_REVIEW" && onEscalate && (
            <button
              type="button"
              disabled={busy}
              onClick={onEscalate}
              className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
            >
              Эскалировать SLA
            </button>
          )}
          {selected.status === "DONE" && (
            <a
              className="rounded-full border border-[#2b72f4] px-4 py-2 text-xs font-semibold text-[#2b72f4]"
              href={`/api/v1/calculations/${selected.id}/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              Открыть PDF
            </a>
          )}
        </div>
      </div>
      <TnvedCardDrawer code={cardCode} onClose={() => setCardCode(null)} />
    </div>
  );
}
