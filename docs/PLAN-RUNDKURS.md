# Rundkurs-Vorschlag

**Stand:** 25.10.2026. Von den Gründern freigegeben (25.10.2026). Umgesetzt auf Branch `claude/rundkurs`.
**Grundlage:** `CLAUDE.md` (Datenschutz, kein Teilen, Karten OpenStreetMap + MapLibre), `docs/PLAN-PHASE-10.md`
11.1 (Kartenkacheln), 12 S2b (Strecken-Vorschläge), 13 (Datenschutz Standort).

## 1. Was die Funktion macht

- **Ausdauer → „Rundkurs vorschlagen“** öffnet einen eigenen Bildschirm (`apps/mobile/src/app/ausdauer/rundkurs.tsx`).
- Die Person wählt **Distanz** (3, 5, 8, 10, 12, 15, 21 oder 30 km) und **Untergrund** (Asphalt, Wald- und Feldwege,
  egal).
- **Start:** „Meinen Standort verwenden“ (einmal, nur auf Tipp) oder ein Tipp auf die Karte. Im Testmodus zusätzlich
  ein Beispiel-Start in Köln.
- Die App schlägt **2–3 Runden** vor. Jede Runde zeigt Karte, Distanz, Höhenmeter (falls bekannt), Anteil Asphalt bzw.
  Wald-/Feldweg und Hinweise („etwas länger als gewünscht“, „teils gleicher Weg hin und zurück“).
- **„Diese Runde laufen“** startet die Aufzeichnung. Die Runde ist dort als Linie auf einer Karte zu sehen, darunter
  steht „Noch ca. … km bis zum Start“. Beim Speichern sind der Name und „Favorit“ vorbelegt. So wird die Runde nach dem
  ersten Lauf eine **„Meine Strecke“**.
- **„Als Meine Strecke merken“** legt die Runde unter „Gemerkte Runden“ ab. Die gemerkte Runde bleibt **nur auf diesem
  Gerät** (App verschlüsselt, Browser nur für die Sitzung). Von dort kann man sie später laufen oder entfernen.
- **Zustände:** Laden („Wir suchen passende Runden …“), leer (keine passende Runde), nicht eingerichtet, zu viele
  Anfragen, Dienst antwortet nicht, keine Verbindung. Die Karte zeigt immer die Quellenangabe. Lädt sie nicht, erscheint
  eine Skizze der Runden.

## 2. Woher die Runden kommen: Entscheidung

| Option                                          | Rundkurs-Funktion                                          | Schlüssel                      | Bedingungen / Grenzen                                                                                                                     | Server-Standort                     | Bewertung                                                              |
| ----------------------------------------------- | ---------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| **(a) BRouter, öffentlicher Server brouter.de** | ja (neuere Versionen: `engineMode=4`, `roundTripDistance`) | nein                           | privater Server ohne Zusage zur Erreichbarkeit, wenig Kapazität („eine Sitzung beendet die andere“), keine Freigabe für App-Massennutzung | DE                                  | **Nicht** für die App; gut als **eigener Server** später (Open Source) |
| **(b) openrouteservice (HeiGIT, Heidelberg)**   | ja: `options.round_trip` mit `length`, `points`, `seed`    | ja (kostenlos, Standard-Konto) | Standard-Konto: ca. **2.000 Routen/Tag, 40/Minute**; Rundkurse bis 100 km; Höhe (`elevation`) und Untergrund (`extra_info`) dabei         | **DE** (gemeinnützige HeiGIT gGmbH) | **Gewählt**                                                            |
| (c) GraphHopper (München)                       | ja: `algorithm=round_trip`, `round_trip.distance`, `seed`  | ja                             | kostenloses Konto nur **nicht-kommerziell**, ca. 500 Credits/Tag; bezahlt ab ca. 50 €/Monat                                               | DE/EU                               | Ersatz, falls ORS nicht reicht                                         |

**Entscheidung: openrouteservice (b), angesprochen nur über unseren eigenen Server** (`apps/web`, Route
`POST /api/strecken/rundkurs`):

- Der Dienst kann **echte Rundkurse** von einem Startpunkt aus. Er liefert **Höhenmeter** und **Untergrund** gleich mit.
  Beides brauchen wir für „Asphalt / Wald- und Feldwege“.
- Betreiber und Server sitzen in **Deutschland**. Der Betreiber ist gemeinnützig, das Konto kostenlos.
- Der **Schlüssel** liegt nur in Vercel (`ORS_API_KEY`, Projekt „Web“). Die App kennt ihn nie.
- Wechsel später möglich: Die Bewertung (`packages/core/src/routes/loop.ts`) hängt nicht vom Anbieter ab. Nur
  `apps/web/src/lib/loop-routing/ors-client.ts` ist anbieterspezifisch. Ein eigener ORS- oder BRouter-Server
  (Docker, DACH-Daten) ist der Weg, wenn die Nutzung wächst.
- **Geprüft:** Aus dieser Umgebung gab es keinen Netzzugang zu ORS, BRouter oder GraphHopper. Umgesetzt ist deshalb
  nach der dokumentierten API. Getestet wird mit Attrappen, ohne echte Anfrage. **Vor dem Livegang** muss eine echte
  Anfrage geprüft werden (Teil 7rk der Handy-Anleitung). Prüfen: Antwortformat (GeoJSON, `ascent`,
  `extras.surface.summary`) und die aktuellen Nutzungsbedingungen von ORS für die **kommerzielle Nutzung** im
  Standard-Konto. Falls nötig, bei HeiGIT nachfragen bzw. einen bezahlten Plan oder einen eigenen Server nehmen.

## 3. Ablauf und Regeln

1. **App:** Startpunkt **auf dem Gerät auf ein 50-m-Raster runden** (`roundStartPoint`, höchstens ca. 36 m daneben).
   Danach `{ lat, lng, distance_km, surface, variant }` im Körper an `apps/web` senden, mit Login-Token. In der Adresse
   steht nichts.
2. **Server:** Er prüft Reihenfolge Herkunft (CORS) → Einstellungen → Login (Supabase-Token) → Körper (≤ 256 Byte,
   Zod streng) → Bremse. Die Bremse erlaubt je Person 6 Anfragen in 10 Minuten und 30 am Tag, insgesamt 10 je Minute.
   Danach rundet der Server den Start noch einmal auf 50 m.
3. **Vier Runden** fragt der Server gleichzeitig bei ORS an, jede mit anderem `seed`. Die bestellte Länge ist 8 % kürzer,
   weil ORS eher zu lang liefert. Profil: `foot-hiking` bei Wald- und Feldwegen, sonst `foot-walking`.
4. **Bewertung** (`rankLoops`, packages/core): Eine Runde fällt weg, wenn sie mehr als 35 % neben der Wunschdistanz liegt
   oder zu mehr als 50 % „hin und zurück“ auf demselben Weg führt. Dann gibt es Abzüge für die Distanz-Abweichung, für
   doppelte Wege und für Untergrund gegen den Wunsch. Runden, die zu mehr als 70 % gleich verlaufen, kommen nur einmal
   vor. Höchstens 3 Runden, vereinfacht (Douglas-Peucker) und als Polyline.
5. **„Andere Runden“** erhöht `variant` (neue `seed`-Werte, höchstens 20-mal).
6. Alle Zahlen stehen in `LOOP_ROUTE` (`packages/core/src/constants.ts`). Sie sind ein Vorschlag und müssen mit echten
   Anfragen nachjustiert werden.

**Testmodus und Tests:** `mockLoopCandidates` (packages/core) erzeugt ausgedachte, gewellte Runden. Jede vierte ist
absichtlich „hin und zurück“, damit das Aussortieren geprüft wird. Die Routen arbeiten ohne Netz. Mit
`LOOP_ROUTING_PROVIDER=attrappe` nutzt auch der Server die Attrappe, zum Testen einer Vorschau ohne Schlüssel.

## 4. Datenschutz – Datenfluss (für die Datenschutzerklärung)

| Schritt                    | Welche Daten                                                                                        | Empfänger                                                                         | Gespeichert?                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standort bestimmen         | GPS-Position, einmal, nur auf Tipp                                                                  | nur das Gerät                                                                     | nein                                                                                                                                                     |
| Vorschlag anfragen         | Startpunkt **auf 50 m gerundet**, Distanz, Untergrund, Variante, Login-Token, IP                    | unser Server (Vercel, Region Frankfurt)                                           | **nein**. Logs enthalten nur feste Codes, nie Koordinaten. Die Bremse speichert nur einen SHA-256-Prüfwert der Nutzer-ID mit Uhrzeit, im Arbeitsspeicher |
| Routing                    | gerundeter Startpunkt, Länge, `seed`, Profil (**keine** Nutzer-ID, IP des Servers statt der Person) | **openrouteservice / HeiGIT gGmbH, Heidelberg** (Auftragsverarbeitung prüfen)     | laut ORS kurzzeitige Server-Logs; vor Livegang bestätigen lassen                                                                                         |
| Karte anzeigen             | Kartenausschnitt (Kacheln), IP                                                                      | Kartenanbieter (Testphase OpenFreeMap, später eigener Server, PLAN-PHASE-10 11.1) | wie bisher bei der Strecken-Karte                                                                                                                        |
| Runde merken               | Linie, Distanz, Höhenmeter, Name                                                                    | nur das Gerät (App: AES-256-GCM, eigener Schlüssel; Browser: sessionStorage)      | ja, nur lokal, je Konto getrennt                                                                                                                         |
| Runde laufen und speichern | wie jede Aufzeichnung (`tracked_routes`)                                                            | unsere Datenbank (RLS, nur eigene)                                                | ja, wie bisher                                                                                                                                           |

- **Rechtsgrundlage:** Die Person fordert den Vorschlag selbst an (Vertrag, Art. 6 Abs. 1 b DSGVO). Standort ist kein
  Gesundheitsdatum (W-G15).
- Kein Teilen, keine öffentlichen Strecken, keine Ranglisten. Vorschläge sind privat.
- **Text für die Datenschutzerklärung (Vorschlag):** „Rundkurs-Vorschlag: Wenn du Runden vorschlagen lässt, senden wir
  deinen auf etwa 50 m gerundeten Startpunkt, die gewünschte Distanz und den Untergrund an unseren Server in Frankfurt.
  Von dort gehen sie ohne deinen Namen oder deine Konto-Kennung an den Routing-Dienst openrouteservice der HeiGIT gGmbH
  (Heidelberg). Wir speichern diese Angaben nicht. Gemerkte Runden bleiben nur auf deinem Gerät.“

## 5. Geänderte und neue Dateien

- Core: `packages/core/src/routes/loop.ts`, `loop-mock.ts` (+ Tests), `LOOP_ROUTE` in `constants.ts`.
- Server: `apps/web/src/app/api/strecken/rundkurs/route.ts`, `apps/web/src/lib/loop-routing/*` (+ Tests).
- App:
  - neuer Bildschirm `app/ausdauer/rundkurs.tsx`;
  - Komponenten `loop-map(.native).tsx`, `loop-sketch.tsx`, `loop-guide-card.tsx`;
  - `lib/loop-*.ts`, `lib/current-position(.native).ts`, `data/loop-routing.ts`, Texte `i18n/de-loop.ts`.
- Kleine Eingriffe in bestehende Dateien:
  - ein Einstiegsknopf in `ausdauer/index.tsx`;
  - in `ausdauer/aufzeichnen.tsx` Parameter `guide`, Leitlinien-Karte sowie Name und Favorit vorbelegt;
  - eine optionale Methode `planLoopRoutes` in `backend.ts`, `supabase-backend.ts` und `local-backend.ts`;
  - der Textschlüssel `t.loop`.
- `.env.example`: `ORS_API_KEY`, `LOOP_ROUTING_PROVIDER`.
- E2E: `apps/mobile/e2e/loop-route.spec.ts`. Bildschirmfotos: `loop-route-screenshots.spec.ts`, nur mit
  `SCREENSHOT_DIR`.

## 6. Offene Punkte

1. **ORS-Konto und Bedingungen:** Schlüssel anlegen (Handy-Anleitung Teil 7rk). Die kommerzielle Nutzung im
   Standard-Konto und die Auftragsverarbeitung (AVV) mit HeiGIT klären. Eine echte Anfrage prüfen (Format, Längen,
   Untergrund in DACH).
2. **Bremse dauerhaft machen:** Heute zählt jede Server-Instanz für sich, im Arbeitsspeicher. Vor dem Livegang braucht
   es einen Zähler in der Datenbank (Migration mit RLS, wie `food_product_lookup_counts`).
3. **Premium:** PLAN-PHASE-10 / KONZEPT 13 führen „Strecken-Vorschläge“ als Premium. In der Testphase ist die Funktion
   offen. Die Premium-Prüfung auf dem Server kommt mit Phase 7.
4. **„Meine Strecken“ zusammenführen:** Branch `claude/meine-strecken` baut die Liste „Meine Strecken“ um. Gemerkte
   Runden liegen bis dahin nur auf dem Gerät. Zu klären ist, ob geplante, noch nicht gelaufene Runden auch im Konto
   gespeichert werden sollen. Dafür bräuchte es eine eigene Tabelle, da `tracked_routes` eine Dauer verlangt.
5. **Eigene Position auf der Leitlinien-Karte** während des Laufens (heute: Linie, Start und Restdistanz). Keine
   Abbiegehinweise (PLAN-PHASE-10: „Navigation nicht geplant“).
6. **Gemerkte Runden beim Löschen des Kontos bzw. Abmelden** mit entfernen. Heute sind sie je Konto getrennt und bleiben
   auf dem Gerät.
7. **Rad als Sportart** für Rundkurse (ORS-Profil `cycling-regular` bzw. `cycling-mountain`). Heute gibt es nur Laufen.
