"use client";

import { useMemo, useState } from "react";
import type { ClarificationQuestion } from "@/lbm-bro/lib/clarify-ai";
import { CUSTOM_OPTION_ID } from "@/lbm-bro/lib/clarify-options";

type Props = {
  question: ClarificationQuestion;
  value: string;
  onChange: (value: string) => void;
};

export function ClarifyField({ question, value, onChange }: Props) {
  const isChoice = question.kind === "choice" && question.options?.length;
  const options = question.options || [];

  const matched = useMemo(
    () => options.find((o) => o.id !== CUSTOM_OPTION_ID && o.value === value),
    [options, value],
  );

  const [customMode, setCustomMode] = useState(() => Boolean(
    question.allowCustom && value && !matched,
  ));

  if (!isChoice) {
    return (
      <input
        value={value}
        placeholder={question.hint || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const activeId = matched?.id || (customMode ? CUSTOM_OPTION_ID : "");

  return (
    <div>
      <div className="amt-chips clarify-chips">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={activeId === opt.id ? "on" : ""}
            onClick={() => {
              if (opt.id === CUSTOM_OPTION_ID) {
                setCustomMode(true);
                onChange("");
                return;
              }
              setCustomMode(false);
              onChange(opt.value);
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {question.hint ? <p className="meta" style={{ margin: "8px 0 0" }}>{question.hint}</p> : null}
      {question.allowCustom && customMode ? (
        <input
          value={value}
          placeholder="Укажите свой вариант"
          onChange={(e) => onChange(e.target.value)}
          style={{ marginTop: 8 }}
        />
      ) : null}
    </div>
  );
}
