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
- Bundle ID: `com.choice.dating`
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

### Auto-Renewable Subscription anlegen

- Subscription Group: `Choice Plus`
- Reference Name: `Choice Plus monatlich`
- Product ID: `choice_plus_monthly`
- Laufzeit: `1 Monat`
- Deutscher Preis: `9,99 €`
- Display Name: `Choice Plus`
- Beschreibung:
  - `Bis zu ein bewusst ausgewähltes Match pro Tag, ohne Match-Guthaben.`

Vor der ersten Einreichung:

- Screenshot für die App-Review-Informationen hinterlegen.
- Abo zusammen mit einer neuen App-Version zur Prüfung einreichen.
- In den Review Notes erklären, wo `Choice Plus`, `Käufe wiederherstellen` und `Abo im Store verwalten` zu finden sind.
- Datenschutz-URL: `https://choice-dating.app/datenschutz`
- Nutzungsbedingungen: `https://choice-dating.app/agb`
- In der App-Store-Beschreibung kenntlich machen, dass Choice Plus ein zusätzlicher In-App-Kauf ist.
- Unter App-Datenschutz `Käufe > Kaufverlauf` als mit der Identität verknüpft und für App-Funktionalität verwendet angeben, sofern die endgültige Datenflussprüfung nichts Abweichendes ergibt.

## 3. Google Play Console

### App anlegen

- App Name: `Choice`
- Package Name: `com.choice.dating`

### In-App Product anlegen

- Product ID: `match_pack_8`
- Name: `8 weitere Matches`
- Beschreibung:
  - `Schaltet 8 weitere Matches frei, sobald deine ersten 8 Matches aufgebraucht sind.`
- Preis: `3,99 €`

### Subscription anlegen

- Product ID: `choice_plus_monthly`
- Base Plan: monatlich, automatisch verlängernd
- Name: `Choice Plus`
- Beschreibung:
  - `Bis zu ein bewusst ausgewähltes Match pro Tag, ohne Match-Guthaben.`
- Deutscher Preis: `9,99 €`

## 4. RevenueCat

### Projekt

- Project Name: `Choice`

### Apps

- iOS App Bundle ID: `com.choice.dating`
- Android Package: `com.choice.dating`

### Product Mapping

- Product ID: `match_pack_8`
- Credits: `8`
- Produkttyp: `Consumable / In-App Product`

### Choice Plus Mapping

- Product ID: `choice_plus_monthly`
- Produkttyp: `Auto-renewable subscription`
- Entitlement ID: `choice_plus`
- Offering: `default`
- Package: `$rc_monthly` oder ein eigenes Monthly-Package

Der RevenueCat-Webhook muss mindestens diese Ereignisse senden:

- `INITIAL_PURCHASE`
- `RENEWAL`
- `CANCELLATION`
- `UNCANCELLATION`
- `EXPIRATION`
- `BILLING_ISSUE`
- `SUBSCRIPTION_EXTENDED`

### Public SDK Keys

Diese spaeter in die App-Umgebung setzen:

- `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY`

### Webhook Secret

Dieses spaeter in die API-Umgebung setzen:

- `REVENUECAT_WEBHOOK_AUTH`

Webhook-URL:

- `https://api.choice-dating.app/v1/purchases/revenuecat/webhook`
- Authorization Header: `Bearer <REVENUECAT_WEBHOOK_AUTH>`

## 5. Code-Stand im Projekt

Bereits vorbereitet:

- Produkt-ID im App-Code: `match_pack_8`
- Credit-Menge pro Kauf: `8`
- Abo-Produkt-ID im App-Code: `choice_plus_monthly`
- Abo-Entitlement: `choice_plus`
- Ein aktives Abo entfernt nur das Match-Guthaben-Limit. Es bleibt bei maximal einem aktiven Match und bei bis zu einem neuen Match pro Tag.
- RevenueCat-Client-Helfer in:
  - `/Users/alexandrgotfrid/Choice App/src/lib/purchases.ts`
- Backend-Kaufmodell / Webhook in:
  - `/Users/alexandrgotfrid/Choice App/api/src/lib/purchases.ts`
  - `/Users/alexandrgotfrid/Choice App/api/src/routes/purchases.ts`

## 6. Nächster technischer Schritt

Wenn Apple und RevenueCat stehen:

1. Match-Paket und Choice-Plus-Abo in App Store Connect anlegen.
2. Beide Produkte mit RevenueCat verbinden und das Entitlement `choice_plus` zuweisen.
3. RevenueCat API Keys in `.env` setzen.
4. `REVENUECAT_WEBHOOK_AUTH` in Render für `choice-api` setzen.
5. RevenueCat-Webhook konfigurieren und einen Test-Webhook senden.
6. Build mit EAS erstellen.
7. Paketkauf, Abo-Abschluss, Kündigung, Ablauf und Wiederherstellung über Apple Sandbox bzw. TestFlight prüfen.

Wichtig:

- Expo Go kann native In-App-Käufe nicht zuverlässig testen. Dafür TestFlight oder einen Development Build verwenden.
- Das Löschen eines Choice-Kontos kündigt ein Store-Abo nicht automatisch.
- Gekaufte Match-Guthaben dürfen nicht ablaufen. Bei Pausen oder Sperren werden sie nur eingefroren.
