"use client";

import { Icon } from "@/lbm-bro/components/icon";
import { PayMath } from "@/lbm-bro/components/pay-math";

export function UpgradeTile({
  icon,
  tag,
  title,
  desc,
  items,
  price,
  note,
  featured,
  tone,
  cta,
  primary,
  payAmount,
  balance,
  onClick,
}: {
  icon: "chart" | "users" | "wallet";
  tag?: string;
  title: string;
  desc: string;
  items?: string[];
  price: string;
  note?: string;
  featured?: boolean;
  tone?: "bill";
  cta: string;
  primary?: boolean;
  payAmount?: number;
  balance?: number;
  onClick: () => void;
}) {
  return (
    <article className={`upgrade-tile${featured ? " featured" : ""}${tone === "bill" ? " bill" : ""}`}>
      <div className="ut-head">
        <div className="ut-ico"><Icon name={icon} lg /></div>
        {tag ? <span className="ut-tag">{tag}</span> : null}
      </div>
      <h4>{title}</h4>
      <p>{desc}</p>
      {items?.length ? (
        <ul>
          {items.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
      <div className="ut-price">
        {price}
        {note ? <small>{note}</small> : null}
      </div>
      {typeof payAmount === "number" && typeof balance === "number" ? (
        <PayMath balance={balance} amount={payAmount} showAfter={false} />
      ) : null}
      <button type="button" className={primary ? "btn btn-primary" : "btn btn-ghost"} onClick={onClick}>
        {cta}
      </button>
    </article>
  );
}
