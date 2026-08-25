import { describe, expect, it } from "vitest";
import { clientNavHint, clientNavTone } from "../LbmCabinetsShell";

describe("lbm cabinet chrome mapping", () => {
  it("maps client nav labels to product-shell tones", () => {
    expect(clientNavTone("Дашборд")).toBe("nav-home");
    expect(clientNavTone("Заявки / просчёты")).toBe("orders");
    expect(clientNavTone("Поддержка")).toBe("chats");
    expect(clientNavTone("Профиль")).toBe("company");
    expect(clientNavTone("Производитель")).toBe("tnved");
    expect(clientNavTone("Брокеры")).toBe("chats");
    expect(clientNavTone("Баланс")).toBe("company");
  });

  it("keeps short hints under tiles", () => {
    expect(clientNavHint("Дашборд")).toBe("Кабинет");
    expect(clientNavHint("Заявки / просчёты")).toBe("Просчёты");
    expect(clientNavHint("Профиль")).toBe("Компания");
    expect(clientNavHint("Брокеры")).toBe("Эксперты");
    expect(clientNavHint("Перевозка")).toBe("После DONE");
  });
});
