# Träningsreturen

Webbapp för Bostads AB Mimer: anställda registrerar pulshöjande träning och får tillbaka
20 % av tiden som ledighet. Chefer attesterar uttag, admin har full insyn och
rättningsmöjlighet.

## Arkitektur

| Del      | Teknik                                                                |
| -------- | --------------------------------------------------------------------- |
| Frontend | React + TypeScript (Vite), självhostad Outfit, svenska i UI:t         |
| Backend  | Node.js + TypeScript (Koa), REST-API med OpenAPI på `/swagger`        |
| Regler   | Ren, enhetstestad modul i `backend/src/rules/` (saldo härleds alltid) |
| Databas  | SQL Server med versionshanterade migrations (knex)                    |
| Auth     | Keycloak via OIDC — JWT valideras per anrop, roller ur token          |
| Drift    | On-prem, Docker + compose, konfiguration via miljövariabler           |

### Regelmotorn (hårda regler)

- 20 % av träningstiden blir ledighet (1 h = 12 min).
- Veckotak 36 min intjänad ledighet per kalendervecka (mån–sön); överskjutande
  träning loggas men ger inget; allokering per pass i datumordning.
- Uttag i kvartssteg (min 0,25 h); dras från saldot först efter attest. Avslag
  påverkar aldrig saldot.
- Registrering max 60 dagar bakåt, aldrig framåt.
- Förfall bakom feature-flaggan `FEATURE_EXPIRY` (KONCEPT): 12 månaders
  giltighet, FIFO vid uttag, automatiska förfallorader + notis.
- Saldo och kontoutdrag beräknas alltid från händelserna — ingen lagrad
  saldokolumn.
- Alla saldopåverkande händelser och adminåtgärder skrivs till `audit_log`.

## Start från ren miljö (Docker)

```bash
cp .env.template .env        # sätt DB_PASSWORD och KEYCLOAK_ADMIN_PASSWORD
docker compose up --build
```

Detta startar SQL Server, Keycloak (importerar realmen `traningsreturen`),
backend (kör migrations automatiskt) och frontend.

- Frontend: http://localhost:8081
- Backend/Swagger: http://localhost:4000/swagger
- Keycloak admin: http://localhost:8080

Demodata (svensk, samma som prototypen) seedas med `SEED_DEMO_DATA=true` i
`.env`, eller manuellt:

```bash
docker compose exec backend node backend/dist/db/seed/run.js
```

### Inloggning (Keycloak-realm som importeras)

| Användare      | Roll              | Lösenord |
| -------------- | ----------------- | -------- |
| sara.lindqvist | employee          | demo123  |
| anna.berg      | employee, manager | demo123  |
| peter.ekstrom  | employee, admin   | demo123  |
| maria.holm     | employee, manager | demo123  |
| daniel.strom   | employee, manager | demo123  |

## Lokal utveckling

```bash
pnpm install
docker compose up mssql keycloak      # databas + Keycloak
cp backend/.env.template backend/.env # AUTH_MODE=demo som standard
pnpm run db:migrate
pnpm run db:seed
pnpm run dev                          # backend :4000 + frontend :5173
```

I demoläge (`AUTH_MODE=demo`) finns prototypens rollväxlare kvar uppe till
höger och ingen Keycloak-inloggning krävs. I `oidc`-läge visas växlaren bara
för användare med flera roller.

## Miljövariabler

Se [.env.template](.env.template). De viktigaste:

| Variabel                          | Beskrivning                               | Default |
| --------------------------------- | ----------------------------------------- | ------- |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | SQL Server-anslutning                     | –       |
| `AUTH_MODE`                       | `oidc` (produktion) eller `demo`          | `oidc`  |
| `OIDC_ISSUER`                     | Keycloak realm-URL                        | –       |
| `OIDC_JWKS_URI`                   | JWKS-endpoint (default härledd ur issuer) | –       |
| `FEATURE_EXPIRY`                  | Förfallo-konceptet på/av                  | `false` |
| `RULES_RETURN_SHARE_PERCENT`      | Andel av träningstid som blir ledighet    | `20`    |
| `RULES_WEEKLY_CAP_MINUTES`        | Veckotak i minuter                        | `36`    |
| `RULES_MAX_BACKDATE_DAYS`         | Max antal dagar bakåt för registrering    | `60`    |
| `SEED_DEMO_DATA`                  | Seed:a demodata vid backend-start         | `false` |
| `CORS_ORIGIN`                     | Tillåten frontend-origin                  | –       |

## Test & verifiering

```bash
pnpm run test        # regelmotorns enhetstester (Jest)
pnpm run typecheck   # TypeScript i alla paket
```

## Struktur

```
backend/
  src/rules/          # regelmotorn (ren modul, enhetstestad)
  src/db/migrations/  # versionshanterade SQL Server-migrations
  src/db/seed/        # svensk demodata (samma som prototypen)
  src/routes/         # REST-API (me, workouts, leaves, manager, admin)
  src/auth/           # OIDC JWT-validering + demo-läge
frontend/
  src/views/          # medarbetare, chef, admin — trogen prototypen
  public/fonts/       # Outfit (självhostad)
deploy/
  keycloak/           # realm-import (roller, demoanvändare)
```

## Utanför scope

HR-/löneintegrationer, utbetalning i pengar, native mobilappar.
