# Choice Payment Setup

## 1. Apple Developer Enrollment

### Entity Type

- Wenn du **keine eingetragene Firma** hast und schnell starten willst:
  - `Individual / Sole Proprietor`
- Wenn die App **unter einem Firmennamen** im App Store erscheinen soll und du eine echte juristische Firma hast:
  - `Company / Organization`

### Empfehlung fuer deinen aktuellen Stand

- Wenn `Choice` aktuell noch ueber dich persoenlich laeuft:
  - **`Individual / Sole Proprietor`**

Wichtig:
- Bei `Individual / Sole Proprietor` steht im App Store dein persoenlicher Name als Seller.
- Fuer einen spaeteren Firmenauftritt ist `Company / Organization` sauberer, braucht aber eine echte Firma und meist eine D-U-N-S-Nummer.

## 2. Apple App Store Connect

### App anlegen

- App Name: `Choice`
- Primary Language: `German (Germany)` oder `English (U.S.)`
- Bundle ID: `com.choice.app`
- SKU: `choice-ios-main`

### In-App Purchase anlegen

- Typ: `Consumable`
- Reference Name: `8 weitere Matches`
- Product ID: `match_pack_8`
- Preis: Tier fuer `3,99 €`

### Lokalisierung

- Display Name: `8 weitere Matches`
- Beschreibung:
  - `Schaltet 8 weitere Matches frei, sobald deine ersten 8 Matches aufgebraucht sind.`

## 3. Google Play Console

### App anlegen

- App Name: `Choice`
- Package Name: `com.choice.app`

### In-App Product anlegen

- Product ID: `match_pack_8`
- Name: `8 weitere Matches`
- Beschreibung:
  - `Schaltet 8 weitere Matches frei, sobald deine ersten 8 Matches aufgebraucht sind.`
- Preis: `3,99 €`

## 4. RevenueCat

### Projekt

- Project Name: `Choice`

### Apps

- iOS App Bundle ID: `com.choice.app`
- Android Package: `com.choice.app`

### Product Mapping

- Product ID: `match_pack_8`
- Credits: `8`
- Produkttyp: `Consumable / In-App Product`

### Public SDK Keys

Diese spaeter in die App-Umgebung setzen:

- `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY`

### Webhook Secret

Dieses spaeter in die API-Umgebung setzen:

- `REVENUECAT_WEBHOOK_AUTH`

## 5. Code-Stand im Projekt

Bereits vorbereitet:

- Produkt-ID im App-Code: `match_pack_8`
- Credit-Menge pro Kauf: `8`
- RevenueCat-Client-Helfer in:
  - `/Users/alexandrgotfrid/Choice App/src/lib/purchases.ts`
- Backend-Kaufmodell / Webhook in:
  - `/Users/alexandrgotfrid/Choice App/api/src/lib/purchases.ts`
  - `/Users/alexandrgotfrid/Choice App/api/src/routes/purchases.ts`

## 6. Nächster technischer Schritt

Wenn Apple und RevenueCat stehen:

1. RevenueCat API Keys in `.env`
2. `REVENUECAT_WEBHOOK_AUTH` in Render fuer `choice-api`
3. Build mit EAS
4. Testkauf in Apple Sandbox / TestFlight
