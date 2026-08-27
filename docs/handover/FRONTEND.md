# Фронтенд на другой компьютер (GitHub + Vercel + Cursor)

Канон: [`plan-frontend-handover.md`](../knowledge/plan-frontend-handover.md).  
Жёсткая граница: [`ved-frontend-boundary.mdc`](../knowledge/ved-frontend-boundary.mdc).

## Что агент не может выдать

GitHub Fine-grained PAT и Vercel token **создаёт только владелец** в браузере. Их нельзя сгенерировать из Cloud Agent. Прод-секреты этой VM (`DATABASE_URL` sweb, `S3_*`, ключи LLM, `VERCEL_TOKEN` агента) **в архив не кладутся** — это и есть запрет доступа к БД / хранилищу / AI вне UI.

Демо-вход через продукт (не строка БД): `client@example.com` / `broker@example.com` / `admin@example.com` · `demo1234`.  
Live: https://ibm-cargo-phi.vercel.app · GitHub: https://github.com/TikhonBaruch/Ibm-cargo

## 1. GitHub (владелец)

1. GitHub → репозиторий **Ibm-cargo** → **Settings** → **Collaborators** → пригласить GitHub-логин фронтендера (**Write**, не Admin).
2. Либо Fine-grained PAT **на аккаунт фронтендера** (не owner PAT):
   - Resource owner: тот же user/org, что владеет репо
   - Repository: только `Ibm-cargo`
   - Permissions: **Contents** Read and write, **Pull requests** Read and write, **Metadata** Read
   - Не выдавать: Administration, Secrets, Actions, Workflows admin
3. На втором компьютере: войти в Cursor тем же GitHub-аккаунтом → Clone `https://github.com/TikhonBaruch/Ibm-cargo.git`.

## 2. Vercel (владелец)

1. Vercel → team **tikhonbaruchs-projects** → project **ibm-cargo** → **Settings** → **Access** → Invite (роль Member / Viewer).
2. Не включать доступ к Environment Variables Production.
3. Preview: PR из форка/ветки → Visit Preview. Не путать с чужим хостом `ibm-cargo.vercel.app`.
4. Отдельный Vercel token (аккаунт фронтендера, scope только этот проект, **не** production deploy): https://vercel.com/account/tokens  
   Owner token из Cloud Agent **не копировать**.

## 3. Cursor на втором аккаунте

После clone:

```bash
npm run sync:cursor-rules
```

Проверить, что есть `.cursor/rules/ved-frontend-boundary.mdc` (`alwaysApply`). Если `.cursor/` пустой до sync — правило всё равно в git: `docs/knowledge/ved-frontend-boundary.mdc`.

Разрешённые правки: `src/components/ved/**`, `src/lbm-bro/**`, `app/cabinet|broker|admin|client|login/**`, design-KB.  
Запрещено: `containers/**` (llm/ocr/ai/api), `.env` прод, docker compose mesh, Prisma/psql к sweb.

## 4. Как работать без строки БД

```bash
npm install
# UI править локально; логин проверять на Preview / prod alias
```

`npm run dev` без `DATABASE_URL` не откроет кабинет — так задумано. Не просить и не вставлять sweb URL.

Локальный `.env` только из `docs/handover/env.frontend.example` (публичные URL + свой `NEXTAUTH_SECRET` для localhost). Без `DATABASE_URL` / `S3_*` / `DEEPSEEK_*`.

## 5. Архив

```bash
bash scripts/pack-frontend-handover.sh
```

Zip пишется в каталог артефактов агента (не в git). Внутри: UI-файлы без `containers/` и без `.env`; библиотека правил; `SECRETS-ENVELOPE.txt` с **пустым** местом под PAT/token владельца и сгенерированным localhost `NEXTAUTH_SECRET` (не прод).
