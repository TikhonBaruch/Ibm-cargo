import { fmt } from "@/lbm-bro/lib/format";

export function PayMath({
  balance,
  amount,
  credit,
  showAfter = true,
}: {
  balance: number;
  amount: number;
  credit?: boolean;
  /** Show remaining balance after payment (hidden on tariff upgrade tiles). */
  showAfter?: boolean;
}) {
  const next = credit ? balance + amount : balance - amount;
  const short = !credit && next < 0;
  return (
    <div className="pay-math">
      <div className="pay-row"><span>Сейчас на балансе</span><strong>{fmt(balance)} ₽</strong></div>
      <div className="pay-row">
        <span>{credit ? "Пополнение" : "К оплате"}</span>
        <strong>{credit ? "+" : "−"}{fmt(amount)} ₽</strong>
      </div>
      {showAfter || short ? (
        <div className={`pay-row total${short ? " short" : ""}`}>
          <span>{short ? "Не хватает" : "После оплаты"}</span>
          <strong>{short ? `${fmt(amount - balance)} ₽` : `${fmt(next)} ₽`}</strong>
        </div>
      ) : null}
    </div>
  );
}
