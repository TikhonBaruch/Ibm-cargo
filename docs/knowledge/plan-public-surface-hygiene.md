# План: гигиена служебных констант (без снятия демо-входа)

## Идея

Публичный `/login` **оставляет** демо-учётки (продуктовый вход для проверки). Служебные SUPER-константы и боевые хосты БД не должны лежать открытым текстом в клиентском бандле и в `.env.example`. `robots.txt` не трогаем (не публиковать карту obscure-путей).

## Анализ

- GitHub private; риск — клиентский JS Production и примеры env в git.
- Next.js `middleware.matcher` требует статически разбираемые строки — литерал пути там неизбежен; комментарии с расшифровкой не писать.
- Seed-пароли SUPER/demo **не менять** (значение то же; кодировать константы UI — да).

## Структура

1. `/login` — демо-подсказка client / broker / admin (лишние учётки — комментарий в форме, не в UI).
2. Obscure login — нейтральный copy (без ярлыка роли/CMS).
3. Кодировать SUPER path/email в `src/lib/ved/super-admin.ts`.
4. Infra-панель SUPER: не хардкодить seed-пароль; credentials только из env.
5. `.env.example` — плейсхолдеры вместо боевого хоста.
6. `public/robots.txt` — не менять.
7. Unit: декод SUPER совпадает; исходник `super-admin.ts` без plaintext path/email; `/login` всё ещё содержит «Демо:».

## Проверка

`npx vitest run src/lib/ved/__tests__/super-admin.test.ts src/lib/ved/__tests__/infra-access.test.ts src/lib/ved/__tests__/public-surface-hygiene.test.ts`
