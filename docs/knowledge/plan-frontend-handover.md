# План: фронтенд-хандовер на другой компьютер / другой аккаунт Cursor

**Статус:** сделано (документы + правило границы + pack-скрипт).  
**Не делать:** класть в git `DATABASE_URL`, `S3_*`, ключи LLM/OCR, `VERCEL_TOKEN` этого агента, пароль sweb.

## Идея

Передать разработку **только UI** на другую машину и другой аккаунт Cursor. Нужны GitHub + Vercel Preview, файловый пакет кабинетов и библиотека правил. Прямой доступ к Postgres, object storage и AI-контейнерам **вне экранов продукта** запрещён.

## Анализ

- Live UI этого репо: Vercel project `ibm-cargo`, alias https://ibm-cargo-phi.vercel.app. Хост `ibm-cargo.vercel.app` — чужой проект.
- Локальный Next без `DATABASE_URL` не логинит (Prisma). Для фронтендера это нормально: правки в git → Preview PR → вход через `/login` демо-ролями. Это доступ **через функционал продукта**, не через строку БД.
- GitHub PAT и Vercel token **нельзя сгенерировать из агента**. Их создаёт владелец в дашбордах и кладёт в конверт вне git.
- Контейнеры `containers/{llm,ocr,ai,api,…}` и Compose mesh в пакет не входят.

## Структура

1. Канон правила: `docs/knowledge/ved-frontend-boundary.mdc` (`alwaysApply`) + sync в `.cursor/rules/`.
2. Инструкция доступов: `docs/handover/FRONTEND.md`.
3. Пример env без секретов: `docs/handover/env.frontend.example`.
4. Pack: `scripts/pack-frontend-handover.sh` → zip в артефакты (конверт с localhost secret, не в git). Публичный zip: `bash scripts/pack-frontend-handover.sh --github` → `docs/handover/lbm-frontend-handover.zip` **без** секретов (запрос владельца: выложить архив на GitHub).
5. KB индекс + `test:structure` на наличие правила.

## Проверка

- `npm run test:structure` (файл правила + запрещённые фразы на месте).
- Архив не содержит `DATABASE_URL=`, `S3_SECRET`, `DEEPSEEK_`, `QWEN_`, `VERCEL_TOKEN`.
- Владелец: invite GitHub collaborator + Vercel project member; токены — сам.

## Закрытие

Этот документ + `FRONTEND.md` + `ved-frontend-boundary.mdc`. Merge не обязателен для передачи zip; для другого Cursor-аккаунта правило должно быть в клоне после merge или скопировано из zip в `.cursor/rules/`.
