# Drift i Portainer

Så här körs Träningsreturen i Mimers Portainer-miljö: hur demomiljön är
uppsatt, hur TLS-certifikatet hanteras och vad som behövs för en
produktionsmiljö.

## Demomiljön i korthet

| | |
| --- | --- |
| Adress | https://pubdoc1.mimer.nu:8443 |
| Server | `pubdoc1` (Docker standalone, hanteras i Portainer) |
| Stack | `traningsreturen-dev`, byggs från branchen `develop` |
| Compose-fil | [`docker-compose.portainer.yml`](../docker-compose.portainer.yml) |
| Inloggning | Mimers delade Keycloak `https://auth.dev.mimer.nu`, realm `onecore`, klient `traningsreturen-app` |
| Containrar | `mssql` (SQL Server Express), `backend` (Node), `frontend` (nginx + React) |
| Volymer | `traningsreturen-dev_mssql-data` (databasen), `traningsreturen-certs` (TLS) |

```
webbläsare ──https :8443──▶ frontend (nginx, TLS) ──/api──▶ backend ──▶ mssql
     │                                                         │
     └──────── inloggning ──▶ auth.dev.mimer.nu ◀── JWKS ──────┘
```

- Port **8443** → nginx 443 (TLS). Port **8081** → nginx 80, som bara
  skickar vidare till https.
- Backend och databas exponeras inte utanför Docker-nätverket.
- Portainer klonar repot och **bygger images på servern** vid varje
  redeploy (`pull_policy: build`). Inget container-register används.

### Brancher och miljöer

| Branch | Miljö | Stack |
| --- | --- | --- |
| `develop` | dev/demo, https://pubdoc1.mimer.nu:8443 | `traningsreturen-dev` |
| `main` (taggar) | produktion (ej uppsatt än) | `traningsreturen-prod` |

Nytt arbete mergas till `develop` och testas i dev. När det är klart för
produktion mergas `develop` till `main` och taggas.

### Varför HTTPS är ett krav

Inloggningsbiblioteket (keycloak-js) använder PKCE, som kräver
webbläsarens krypto-API. Det finns bara på HTTPS eller `localhost`. Över
vanlig http fungerar inte inloggningen alls.

## Uppsättning steg för steg

### 1. Git-källa (Portainer → Sources)

- Repository URL: `https://github.com/Bostads-AB-Mimer/traningsreturen.git`
- Authentication: **av**. Repot är publikt, så varken användarnamn eller
  token behövs.
- Om repot görs privat senare: slå på Authentication och använd en
  fine-grained personal access token med åtkomst till enbart detta repo
  (*Contents: Read-only*). Tokenen har ett utgångsdatum som måste bevakas.
- Portainer sparar listan över brancher när sourcen skapas. Om en ny branch
  inte syns: skriv in `refs/heads/<branch>` för hand, eller skapa sourcen på
  nytt.

### 2. TLS-certifikat

Certifikatet ligger i Docker-volymen `traningsreturen-certs`, som
frontend-containern monterar skrivskyddat på `/etc/nginx/certs`. Det
ligger aldrig i Git.

**Vad som behövs från IT (för demomiljön Magnus):**
- Ett certifikat som täcker serverns namn (`pubdoc1.mimer.nu`), i
  **PEM-format med hela kedjan** (servercertifikat + intermediate i samma fil).
- Privat nyckel **utan lösenord**, så att nginx kan starta utan att någon
  matar in något. Den skyddas i stället med filrättigheter (`chmod 600`).
- Port 8443 öppen i brandväggen.

**Filnamn i volymen (måste vara exakt dessa):**

| Fil | Innehåll | Börjar med |
| --- | --- | --- |
| `fullchain.pem` | certifikat + kedja (IT:s .CRT-fil) | `-----BEGIN CERTIFICATE-----` |
| `privkey.pem` | privat nyckel (IT:s .KEY-fil) | `-----BEGIN ... PRIVATE KEY-----` |

**Lägga in certifikatet (utan SSH-åtkomst till servern):**

1. Portainer → Volumes → **Add volume**: namn `traningsreturen-certs`,
   driver `local`. Behövs bara första gången.
2. Containers → **Add container**:
   - Name `cert-helper`, image `alpine`
   - Advanced → Command & logging → Command: `sleep infinity`
   - Volumes → map additional volume: container `/certs` → volym
     `traningsreturen-certs`
3. Öppna `cert-helper` → **Console** → Connect (`/bin/sh`).
4. Skriv `cat > /certs/fullchain.pem`, tryck Enter, klistra in hela
   .CRT-filen, tryck Enter och avsluta med **Ctrl+D**.
5. Gör likadant med nyckeln: `cat > /certs/privkey.pem`.
6. Kontrollera utan att skriva ut nyckeln:
   ```sh
   ls -l /certs
   grep -c BEGIN /certs/fullchain.pem /certs/privkey.pem   # ≥2 resp. 1
   head -1 /certs/fullchain.pem /certs/privkey.pem
   tail -1 /certs/fullchain.pem /certs/privkey.pem
   ```
   Kör aldrig `cat /certs/privkey.pem`.
7. Lås nyckeln: `chmod 600 /certs/privkey.pem`
8. Ta bort containern `cert-helper`. Volymen och filerna finns kvar.
9. **Radera certifikat- och nyckelfilerna från din dator**, töm
   papperskorgen och rensa urklippshistoriken (Win+V). Nyckeln har inget
   lösenord och får inte spridas.

### 3. Keycloak

På klienten `traningsreturen-app` i realmen `onecore`:

- Valid redirect URIs: `https://pubdoc1.mimer.nu:8443/*`
- Valid post logout redirect URIs: `https://pubdoc1.mimer.nu:8443/*`
- Web origins: `+` (följer redirect-URI:erna)

Roller (`employee`, `manager`, `admin`) och attribut-mappers är samma som
lokalt, se [README](../README.md#koppla-mot-mimers-befintliga-keycloak-ad).

### 4. Stack (Portainer → Stacks → Add stack)

- Build method: **Repository**, source `traningsreturen`
- Name: `traningsreturen-dev`
- Reference: `refs/heads/develop`
- Compose path: `docker-compose.portainer.yml`
- Enable relative path volumes: av
- Environment variables: `DB_PASSWORD`, ett starkt lösenord (minst 8 tecken
  med stora och små bokstäver samt siffror, annars startar inte SQL Server)
- **Deploy the stack**. Första bygget tar några minuter.

Efter en redeploy kan sidan ge **HTTP 502** i upp till någon minut, medan
backend väntar på databasen och kör migreringar. Ladda om sidan.

## Löpande drift

### Driftsätta en ny version

Pusha (eller merga) till `develop` och gör sedan **Stacks → traningsreturen-dev → Pull and
redeploy**. Images byggs om och databasen behålls.

### Förnya certifikatet

nginx läser certifikatet bara när containern startar.

1. Gör om steg 2–8 under [Lägga in certifikatet](#2-tls-certifikat).
   `cat >` skriver över de gamla filerna.
2. Starta om containern `traningsreturen-dev-frontend-1`
   (Containers → markera → Restart).
3. Kontrollera i webbläsaren (hänglåset → certifikat) att det nya
   utgångsdatumet syns.

Lägg in certifikatets utgångsdatum i kalendern med god marginal.

### Tömma data via SQL (rekommenderas)

Tömmer alla registreringar och användare men behåller aktivitetstyperna.
Stacken körs vidare och certifikatet påverkas inte. Användare skapas på nytt
vid nästa inloggning, med roller från Keycloak.

1. Containers → `traningsreturen-dev-mssql-1` → **Console** → `/bin/bash` → Connect
2. Starta sqlcmd. `-I` behövs, eftersom `users` har ett filtrerat index som
   kräver `QUOTED_IDENTIFIER ON`:
   ```sh
   /opt/mssql-tools18/bin/sqlcmd -C -I -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d traningsreturen
   ```
3. Kör:
   ```sql
   SET XACT_ABORT ON;
   BEGIN TRANSACTION;
   DELETE FROM audit_log;
   DELETE FROM delegations;
   DELETE FROM corrections;
   DELETE FROM leave_requests;
   DELETE FROM workouts;
   -- DELETE FROM activity_types;  -- även aktivitetstyperna (admin måste då lägga in nya)
   UPDATE users SET manager_id = NULL, merged_into_user_id = NULL;
   DELETE FROM users;
   COMMIT;
   GO
   ```
   Om något steg misslyckas rullas allt tillbaka.
4. Kontrollera och avsluta:
   ```sql
   SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM workouts) AS workouts;
   GO
   exit
   ```

### Nollställa databasen helt

Tar bort **all** data, också aktivitetstyperna. Schemat skapas om av migreringarna, och användare
skapas på nytt vid första inloggning (`AUTO_PROVISION_USERS=true`).
Rollerna kommer från Keycloak, så inget behöver läggas in för hand för att
komma in. Manuellt inlagda aktivitetstyper, chefskopplingar och
registreringar försvinner.

1. **Stacks → traningsreturen-dev → Stop this stack**
2. **Volumes** → markera `traningsreturen-dev_mssql-data` → **Remove**. Om
   Portainer säger att volymen används, ta först bort den stoppade
   containern `traningsreturen-dev-mssql-1` under Containers.
3. **Stacks → traningsreturen-dev → Start this stack** (eller *Pull and
   redeploy*)

Rör inte volymen `traningsreturen-certs`.

### Felsökning

| Symptom | Trolig orsak |
| --- | --- |
| Sidan går inte att nå alls | Port 8443 är stängd i brandväggen, eller så kör frontend-containern inte |
| frontend startar inte / startar om hela tiden | Certifikatfilerna saknas, har fel namn, eller nyckeln matchar inte certifikatet. Se loggen för frontend |
| HTTP 502 | Backend startar fortfarande eller har kraschat. Se loggen för backend |
| Keycloak visar "Invalid redirect uri" | Adressen saknas på klienten i Keycloak |
| Inloggning lyckas men API-anrop ger 401 | Fel issuer/realm, eller frontend byggd mot en annan Keycloak än den backend validerar mot |
| SQL Server startar inte | `DB_PASSWORD` uppfyller inte lösenordskraven |

Loggar: Portainer → Containers → klicka på containern → **Logs**.

## Inför produktionsmiljön

Demomiljöns compose-fil har adresser och portar inskrivna direkt. För
produktion görs en egen fil (eller så parametriseras den befintliga) med
egen stack, egna volymer och egen Keycloak-klient. Följande behöver
bestämmas först:

| Fråga | Varför | Vem |
| --- | --- | --- |
| Egen server eller samma som demo? | Separerar prod från demo och tester. Demo och prod på samma server kräver andra portar och volymnamn | IT/Drift |
| Riktigt domännamn på port 443, t.ex. `traningsreturen.mimer.nu`? | Användarna slipper portnummer, och det fungerar bättre genom brandväggar och proxyer | IT/Drift |
| Certifikat för det namnet, och vem förnyar det? | Samma krav som ovan: PEM med kedja, nyckel utan lösenord | IT/Drift |
| Vilken Keycloak/realm? | Demo använder `auth.dev.mimer.nu`. Prod bör använda prod-instansen, med egen klient och egna redirect-URI:er | David / Keycloak-ansvarig |
| Databas: SQL Server i stacken eller Mimers befintliga SQL Server? | En befintlig, driftad SQL Server ger backup och övervakning utan extra arbete. I stacken kräver det egen backup av volymen. Express har en gräns på 10 GB per databas | IT/Drift |
| Backup och återläsning | Krav för produktion, oavsett vilket databasalternativ som väljs | IT/Drift |
| Vem har åtkomst till stacken i Portainer? | Stackens miljövariabler innehåller databaslösenordet | IT/Drift |

Skillnader mot demo i konfigurationen:

- `SEED_DEMO_DATA` måste vara `false`. Seed-skriptet **tömmer alla tabeller**.
- `AUTH_MODE=oidc`. Demoläget (`demo`) får aldrig användas i produktion,
  eftersom vem som helst då kan utge sig för att vara admin.
- `FEATURE_EXPIRY` sätts efter beslut om utgångsregeln.
- Driftsätt från en tagg på `main` (t.ex. `v1.0.0`), inte från en branch, så att
  prod inte uppdateras av misstag vid nästa push.
- Starta med en tom databas, dvs. ny volym eller ny databas.
