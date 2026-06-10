# Choice API

Backend-Grundgerüst fuer `Choice`.

## Stack

- Fastify
- Prisma
- PostgreSQL
- Resend spaeter fuer transaktionale E-Mails
- Twilio Verify spaeter fuer Telefon-OTP
- Cloudinary spaeter fuer Profilbilder

## Verifizierung

Die API unterstuetzt sowohl E-Mail- als auch Telefon-Verifizierung.

Wenn `Choice` direkt mit Telefonnummer starten soll, kann die App den Flow
`Telefonnummer -> Code -> Profil` fahren, noch bevor Vorname und restliche Angaben kommen.

## Start

1. `cp .env.example .env`
2. `npm install`
3. `npm run prisma:generate`
4. `npm run prisma:push`
5. `npm run dev`

## Erste Routen

- `GET /v1/health`
- `POST /v1/auth/email/start`
- `POST /v1/auth/email/verify`
- `POST /v1/auth/phone/start`
- `POST /v1/auth/phone/verify`
- `POST /v1/profiles`

In `development` geben die Auth-Routen den OTP-Code als `devCodePreview` zurueck, damit wir die
App-Verifikation bauen koennen, bevor Resend oder Twilio live dran haengen.
