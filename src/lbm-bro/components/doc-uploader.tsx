"use client";

import { useRef, useState } from "react";
import { Icon } from "@/lbm-bro/components/icon";
import {
  DOC_ACCEPT,
  DOC_MAX_BYTES,
  DOC_MAX_COUNT,
  docLabel,
  filesToDocs,
  fmtBytes,
  revokeDoc,
} from "@/lbm-bro/lib/docs";
import type { OrderDoc } from "@/lbm-bro/lib/types";

export function DocUploader({
  docs,
  onChange,
  onToast,
  compact,
  title,
  hint,
}: {
  docs: OrderDoc[];
  onChange: (next: OrderDoc[]) => void;
  onToast?: (msg: string) => void;
  compact?: boolean;
  title?: string;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const dragDepth = useRef(0);

  async function addFiles(list: FileList | File[] | null) {
    if (!list || !list.length || reading) return;
    const incoming = Array.from(list);
    const tooBig = incoming.filter((f) => f.size > DOC_MAX_BYTES);
    const ok = incoming.filter((f) => f.size <= DOC_MAX_BYTES);
    if (docs.length + ok.length > DOC_MAX_COUNT) {
      onToast?.(`Можно приложить не больше ${DOC_MAX_COUNT} файлов`);
      return;
    }
    if (tooBig.length) {
      onToast?.(`Пропущены файлы больше 12 МБ: ${tooBig.map((f) => f.name).join(", ")}`);
    }
    if (!ok.length) return;
    setReading("Читаем файл…");
    try {
      const added = await filesToDocs(ok, (msg) => setReading(msg));
      onChange([...docs, ...added]);
      const found = added.reduce((s, d) => s + (d.packLines?.length || 0), 0);
      onToast?.(
        found
          ? `${ok.length === 1 ? ok[0].name : "Файлы"}: считано ${found} позиций`
          : ok.length === 1 ? `${ok[0].name} прикреплён` : `Прикреплено файлов: ${ok.length}`,
      );
    } catch {
      onToast?.("Не удалось прочитать файл");
    } finally {
      setReading(null);
    }
  }

  function remove(id: string) {
    const doc = docs.find((d) => d.id === id);
    if (doc) revokeDoc(doc);
    onChange(docs.filter((d) => d.id !== id));
    onToast?.("Файл удалён");
  }

  return (
    <div className="doc-uploader">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={DOC_ACCEPT}
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {!compact ? (
      <div
        className={`dropzone${over ? " over" : ""}${reading ? " reading" : ""}`}
        onClick={() => fileRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <strong>{reading || title || "Перетащите invoice, packing list или таблицу"}</strong>
        <span className="meta">{reading ? "Это займёт несколько секунд, особенно для фото и сканов." : (hint || "CSV, PDF, JPG · читаем реальные позиции · до 12 МБ")}</span>
        <div className="dropzone-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={!!reading}>
            Выбрать файлы
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => camRef.current?.click()} disabled={!!reading}>
            Снять фото
          </button>
        </div>
      </div>
      ) : null}

      {docs.length ? (
        <div className="doc-list">
          {docs.map((doc) => (
            <div key={doc.id} className="doc-chip">
              {doc.preview ? (
                <a
                  href={doc.preview}
                  target="_blank"
                  rel="noreferrer"
                  className="doc-thumb"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img src={doc.preview} alt="" />
                </a>
              ) : (
                <span className="doc-ico"><Icon name="file" /></span>
              )}
              <div className="doc-info">
                <b>{doc.name}</b>
                <span className="meta">{[fmtBytes(doc.size), docLabel(doc)].filter(Boolean).join(" · ")}</span>
              </div>
              <span className="pill ok">
                {doc.kind === "photo" ? "Фото" : doc.kind === "pdf" ? "PDF" : "Файл"}
              </span>
              <button type="button" className="doc-remove" onClick={() => remove(doc.id)}>
                Удалить
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {compact ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: docs.length ? 10 : 0 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={!!reading}>
            Добавить файл
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => camRef.current?.click()} disabled={!!reading}>
            Снять фото
          </button>
        </div>
      ) : null}
    </div>
  );
}
