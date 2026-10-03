# Fitnessapp (Arbeitstitel)

Personalisierte Fitness-App für den DACH-Raum: Trainingsplan, Ernährungsplan mit Einkaufsliste,
Supplementplan und Trainingstagebuch.

- Regeln und Architektur: [`CLAUDE.md`](CLAUDE.md)
- Fachkonzept: [`docs/KONZEPT.md`](docs/KONZEPT.md)
- Umsetzungsphasen: [`docs/PROMPTS.md`](docs/PROMPTS.md)
- Erweiterungen aus dem Brainstorming (eingearbeitet ins Fachkonzept): [`docs/ERWEITERUNGEN.md`](docs/ERWEITERUNGEN.md)
- Arbeiten nur mit dem Handy: [`docs/HANDY-ANLEITUNG.md`](docs/HANDY-ANLEITUNG.md)
- Supabase, Vercel und Expo verbinden: [`docs/SETUP.md`](docs/SETUP.md)
- Farben und Design (eine `theme.css` für App und Website): [`docs/DESIGN.md`](docs/DESIGN.md)
- Plan für Phase 1 (Anmeldung, Einwilligungen, Onboarding): [`docs/PLAN-PHASE-1.md`](docs/PLAN-PHASE-1.md)

## Aufbau

| Ordner              | Inhalt                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `apps/mobile`       | App (Expo + Expo Router) für iOS, Android und Web-Export (Vercel)                           |
| `apps/web`          | Website (Next.js): Landingpage, Redaktionsbereich `/admin`, später API/Webhooks             |
| `packages/core`     | Fachlogik ohne UI – Berechnungen, Plan- und Ernährungs-Engine, Grenzwerte                   |
| `packages/db`       | Datenbank-Typen, Zod-Schemas, Supabase-Client                                               |
| `packages/ui`       | Farbschema `theme.css` (einzige Quelle) + daraus erzeugte App-Tokens                        |
| `packages/content`  | Prüfskript `content:validate`, Content-Generierung (Batch-API) und Seeds                    |
| `content/`          | Inhalte als JSON (Übungen, Plan-Vorlagen) – die einzige Wahrheit, Freigabe per Pull Request |
| `supabase/`         | Datenbank-Migrationen (Region EU/Frankfurt)                                                 |
| `.github/workflows` | Automatisierung: ci, db-migrate, content-generate/-collect/-review/-seed, eas-build         |

Tests, Builds und Migrationen laufen als GitHub Actions – lokal muss nichts ausgeführt werden.
