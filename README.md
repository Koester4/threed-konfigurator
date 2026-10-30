# 3D-Druck Konfigurator

Web-Konfigurator für Großformat-3D-Druck (Bauraum bis 1 × 1 × 1 m): Kunden laden ein
STL/OBJ/3MF-Modell hoch oder wählen eines aus dem Sortiment, wählen Material, Farbe,
Größe und Optionen und sehen sofort Preis, Gewicht und Druckzeit, mit 3D-Vorschau (three.js).

## Starten

```bash
npm install
npm run dev       # Entwicklungsserver mit Live-Reload → http://localhost:5173
npm run build     # erzeugt den Ordner dist/
npm run preview   # testet den fertigen Build lokal
```

## Auf der Webseite betreiben

`npm run build` erzeugt den Ordner **`dist/`**. Er enthält nur statische Dateien (HTML, JS, CSS)
und braucht keinen Server-Code. Den Inhalt einfach per FTP/Webspace hochladen, auch in einen
Unterordner wie `meine-seite.de/konfigurator/`. Einbinden in eine bestehende Seite (z. B. WordPress):

```html
<iframe src="/konfigurator/" style="width:100%;height:1100px;border:0"></iframe>
```

Die hochgeladenen Modelle werden nur im Browser des Kunden verarbeitet und nicht übertragen.

## Preise & Materialien anpassen

Alles steht in **`src/config.js`**:

| Einstellung | Bedeutung |
|---|---|
| `buildVolume` | max. Bauraum in mm (aktuell 1000 × 1000 × 1000) |
| `materials[]` | Name, Dichte (g/cm³), `pricePerKg`, `throughputCm3h` (Druckleistung), Farben; optional `maxSize` für einen kleineren Bauraum je Material, `solid: true` für immer massiv |
| `machineRatePerHour` | Maschinenstundensatz |
| `setupFee`, `minOrder` | Einrichtungspauschale, Mindestauftragswert |
| `infill`, `quality`, `finishing` | Auswahloptionen inkl. Faktoren/Preisen |
| `quantityDiscounts` | Mengenrabatt-Staffel |
| `company.email` | Empfänger der Angebotsanfrage |

### So wird gerechnet (`src/pricing.js`)

1. Volumen und Oberfläche werden exakt aus dem Mesh berechnet und mit der Skalierung hochgerechnet (Volumen ~ s³, Fläche ~ s²).
2. Hülle = Oberfläche × Wandstärke (voll gedruckt), das Innere zählt nur mit dem Füllgrad.
3. Optional +12 % für Stützstrukturen.
4. Material = Gewicht × €/kg, Maschine = (Volumen ÷ Druckleistung × Qualitätsfaktor) × Stundensatz, dazu Oberflächen-Nachbearbeitung pro cm².
5. Abzüglich Mengenrabatt, zuzüglich Einrichtung, mindestens Mindestauftragswert, dann MwSt.

Das Ergebnis ist eine Schätzung. Die Parameter sollten mit echten Slicer-Werten einiger Referenzteile kalibriert werden.

## Projektstruktur

```
index.html          Seitenaufbau
src/config.js       Preise, Materialien, Optionen  ← hier pflegen
src/pricing.js      Preisberechnung & Bauraumprüfung
src/geometry.js     Laden von STL/OBJ/3MF, Volumen-/Flächenberechnung
src/presets.js      Sortimentsmodelle (prozedural erzeugt)
src/viewer.js       three.js 3D-Ansicht
src/main.js         UI-Logik
src/style.css       Design
beispiele/          Test-STL zum Ausprobieren des Uploads
```

## Mögliche nächste Schritte

- **Backend für Anfragen**: Aktuell öffnet „Angebot anfragen“ das E-Mail-Programm (die Datei muss manuell angehängt werden). Mit einem kleinen Endpunkt (PHP, Formspree, Node …) lassen sich Datei und Konfiguration direkt übertragen.
- **Echte Sortimentsmodelle**: STL-Dateien nach `public/modelle/` legen und in `presets.js` per `fetch` laden.
- **Warenkorb/Bezahlung**, z. B. über Shopify/WooCommerce oder Stripe Checkout.
