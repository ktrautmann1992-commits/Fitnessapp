# Fitnessapp (Arbeitstitel)

Personalisierte Fitness-App für den DACH-Raum: Trainingsplan, Ernährungsplan mit Einkaufsliste,
Supplementplan und Trainingstagebuch.

- Regeln und Architektur: [`CLAUDE.md`](CLAUDE.md)
- Fachkonzept: [`docs/KONZEPT.md`](docs/KONZEPT.md)
- Umsetzungsphasen: [`docs/PROMPTS.md`](docs/PROMPTS.md)
- Arbeiten nur mit dem Handy: [`docs/HANDY-ANLEITUNG.md`](docs/HANDY-ANLEITUNG.md)
- Supabase, Vercel und Expo verbinden: [`docs/SETUP.md`](docs/SETUP.md)

## Aufbau

| Ordner              | Inhalt                                                                     |
| ------------------- | -------------------------------------------------------------------------- |
| `apps/mobile`       | App (Expo + Expo Router) für iOS, Android und Web-Export (Vercel)          |
| `apps/web`          | Website (Next.js): Landingpage, später Web-App, Admin, API/Webhooks        |
| `packages/core`     | Fachlogik ohne UI – Berechnungen, Plan- und Ernährungs-Engine, Grenzwerte  |
| `packages/db`       | Datenbank-Typen, Zod-Schemas, Supabase-Client                              |
| `packages/ui`       | Design-Tokens (Farben, Abstände, Schrift)                                  |
| `packages/content`  | Offline-Content-Generierung (Claude Batch-API) und Seeds                   |
| `supabase/`         | Datenbank-Migrationen (Region EU/Frankfurt)                                |
| `.github/workflows` | Automatisierung: ci, db-migrate, content-generate, content-seed, eas-build |

Tests, Builds und Migrationen laufen als GitHub Actions – lokal muss nichts ausgeführt werden.
