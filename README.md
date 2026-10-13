# Träningsreturen

Webbapp för Bostads AB Mimer: anställda registrerar pulshöjande träning och får tillbaka
20 % av tiden som ledighet. Chefer attesterar uttag, admin har full insyn och
rättningsmöjlighet.

## Miljöer och dokumentation

| Miljö         | Adress                         | Branch               |
| ------------- | ------------------------------ | -------------------- |
| Lokal         | http://localhost:8081          | valfri               |
| Dev/demo      | https://pubdoc1.mimer.nu:8443  | `develop`            |
| Produktion    | ej uppsatt än                  | `main` (taggar)      |

- [docs/drift-portainer.md](docs/drift-portainer.md): drift i Portainer,
  TLS-certifikat, Keycloak-inställningar, nollställning av data, felsökning
  och förberedelser inför produktion.

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

Det här avsnittet gäller lokal körning. För dev-miljön i Portainer, se
[docs/drift-portainer.md](docs/drift-portainer.md).

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
pnpm run dev                          # backend :4000 + frontend :8081
```

I demoläge (`AUTH_MODE=demo`) finns prototypens rollväxlare kvar uppe till
höger och ingen Keycloak-inloggning krävs. I `oidc`-läge visas växlaren bara
för användare med flera roller.

## Koppla mot Mimers befintliga Keycloak (AD)

Appen kan använda den delade instansen `https://auth.dev.mimer.nu/realms/onecore`
(AD-federerad via Microsoft-broker) i stället för compose-instansen:

1. Klienten `traningsreturen-app` ska finnas i realmen (public, standard flow,
   PKCE S256, redirect `http://localhost:8081/*`, web origins `+`).
2. Backend: `AUTH_MODE=oidc`, `OIDC_ISSUER=https://auth.dev.mimer.nu/realms/onecore`.
3. Frontend: kopiera `frontend/.env.template` till `frontend/.env`.
4. Roller läses både ur realm-roller och **klientroller**
   (`resource_access.traningsreturen-app.roles`) — skapa `employee`, `manager`,
   `admin` som klientroller på klienten och mappa dem från AD-grupper.
5. `AUTO_PROVISION_USERS=true` skapar app-användaren automatiskt vid första
   AD-inloggningen (namn ur token).
6. **Titel och avdelning synkas från AD** om klienten mappar användarattributen
   till token-claims: lägg till två _User Attribute_-mappers på klienten
   (Client scopes → `traningsreturen-app-dedicated` → Add mapper → By
   configuration → User Attribute) — `jobTitle` → claim `jobTitle` och
   `officeLocation` → claim `officeLocation`, båda med "Add to access token"
   på. Backend läser claimen vid varje inloggning och håller namn, titel och
   avdelning uppdaterade; tomma claims skriver aldrig över befintliga värden.
7. **Chefsrelationen synkas från AD** via användarattributet `managerId`
   (chefens _Keycloak-id_, hämtat ur Graph-relationen `manager` av
   attributsynken). Mappa det till claim `managerId` på samma sätt. Vid varje
   inloggning slås chefen upp mot `users.keycloak_id` (tokenens `sub`) och
   `manager_id` sätts; chefen flaggas samtidigt som delegeringsbar. Har chefen
   inte loggat in ännu lämnas relationen tom och läker automatiskt vid en
   senare inloggning.

## Miljövariabler

Se [.env.template](.env.template). De viktigaste:

| Variabel                          | Beskrivning                                                           | Default               |
| --------------------------------- | --------------------------------------------------------------------- | --------------------- |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | SQL Server-anslutning                                                 | –                     |
| `AUTH_MODE`                       | `oidc` (produktion) eller `demo`                                      | `oidc`                |
| `OIDC_ISSUER`                     | Keycloak realm-URL                                                    | –                     |
| `OIDC_JWKS_URI`                   | JWKS-endpoint (default härledd ur issuer)                             | –                     |
| `FEATURE_EXPIRY`                  | Förfallo-konceptet på/av                                              | `false`               |
| `RULES_RETURN_SHARE_PERCENT`      | Andel av träningstid som blir ledighet                                | `20`                  |
| `RULES_WEEKLY_CAP_MINUTES`        | Veckotak i minuter                                                    | `36`                  |
| `RULES_MAX_BACKDATE_DAYS`         | Max antal dagar bakåt för registrering                                | `60`                  |
| `SEED_DEMO_DATA`                  | Seed:a demodata vid backend-start                                     | `false`               |
| `CORS_ORIGIN`                     | Tillåten frontend-origin                                              | –                     |
| `OIDC_CLIENT_ID`                  | Klient-id; även källa för klientroller (`resource_access.<id>.roles`) | `traningsreturen-app` |
| `AUTO_PROVISION_USERS`            | Skapa app-användare automatiskt vid första AD-inloggning              | `false`               |

### Variabler som bara gäller den lokala compose-Keycloaken

Följande läses enbart av `docker-compose.yml` och rör containern
`traningsreturen-keycloak-1` — de ignoreras helt när appen pekar mot den
delade instansen (`auth.dev.mimer.nu`), och används aldrig av `pnpm run dev`:

| Variabel                                     | Beskrivning                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | Bootstrap-admin för den lokala containerns admin-konsol (localhost:8080)      |
| `PUBLIC_KEYCLOAK_URL`                        | Build-argument till frontend-imagen: Keycloak-URL:en webbläsaren skickas till |
| `PUBLIC_KEYCLOAK_REALM`                      | Build-argument till frontend-imagen: realm (default `traningsreturen`)        |

Vilken Keycloak Docker-stacken använder väljs i `.env` — se de två blocken A
(lokal container) och B (Mimers delade) i [.env.template](.env.template).
Byt hela blocket, sätt `CORS_ORIGIN=http://localhost:8081` och kör
`docker compose up -d --build` (frontend-imagen måste byggas om).

Vilken Keycloak som faktiskt används styrs av `OIDC_ISSUER` (backend) och
`VITE_KEYCLOAK_URL`/`VITE_KEYCLOAK_REALM` (frontend, se
[frontend/.env.template](frontend/.env.template)). Det lokala spåret —
containern, realm-importen i `deploy/keycloak/` och demokontona — finns kvar
som fristående alternativ för den som saknar åtkomst till dev-miljön.

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
