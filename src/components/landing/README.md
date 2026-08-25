# Landing (LBM Брокер)

Порт [`docs/design/refs/cargo-broker-design.html`](../../../docs/design/refs/cargo-broker-design.html).

| Файл | Роль |
|------|------|
| `LandingPage.tsx` | SSR разметки + init FX |
| `LandingAuthShell.tsx` | Шапка лендинга + карточка для `/login` и `/register` |
| `markup.ts` | HTML секций (FX, hero…footer, modal) |
| `landing.css` | Стили референса (scoped `.landing-root`) |
| `initLanding.ts` | Интерактив + анимации (parallax, particles, float, steps…) |

Ассеты: `/public/landing/assets/*.jpg`
