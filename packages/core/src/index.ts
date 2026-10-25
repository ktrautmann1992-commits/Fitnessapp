export * from './constants';
export { ageInYears, isoDateSchema, meetsMinimumAge } from './age';
export * from './enums';
export * from './dates';
export * from './consent';
export * from './equipment';
export * from './food-groups';
export * from './health-screening';
// Fit im Alter: Zusatzfragen im Gesundheits-Check (docs/PLAN-FIT-IM-ALTER.md 8.2, FA1 Teil 2).
export * from './aging-screening';
export * from './function-tests';
export * from './body-measurements';
export * from './onboarding';
export * from './validation';
export * from './training-schedule';
export * from './goals';
export * from './content';
export * from './plan';
export * from './log';
export * from './adjust';
export * from './export';
export * from './nutrition';
export * from './evaluation';
export * from './retail';
export * from './routes';
// Schuh-Kilometerzähler (docs/PLAN-PHASE-10.md Abschnitt 22).
export * from './shoes';
export * from './share';
export * from './dashboard';
// Widget auf dem Startbildschirm (docs/PLAN-WIDGET.md).
export * from './widget';
export * from './layout';
export * from './notifications';
// Barrierefreiheit (docs/PLAN-FIT-IM-ALTER.md 12, Etappe FA5).
export * from './accessibility';
// Zyklus-Modul (docs/PLAN-PHASE-9.md, ZY1) und „Heute leichter“ (gemeinsam mit Phase 8b).
export * from './cycle';
export * from './plan/day-variant';
// Workout-Bibliothek (docs/PLAN-WORKOUTS.md).
export * from './workouts';
// Trainings-Modi: Schmerz-/Verletzungsmodus, Reise-Modus, Aufwärmen & Dehnen (docs/PLAN-TRAINING-MODI.md).
export * from './modes';
// Phase 8 · Wearables: Galaxy Watch über Health Connect (docs/PLAN-PHASE-8.md).
export * from './wearables';
// Sportarten Stufe 2 (docs/PLAN-SPORTARTEN.md).
export * from './sports';
// Supplement-Modul (docs/PLAN-PHASE-6.md, Etappe SU1). Im Ordner `supplements/` gibt es bewusst KEIN index.ts
// (Wächter S1): Die Dateien werden hier einzeln weitergereicht; Affiliate (SU5) wird hier nie weitergereicht.
export * from './supplement-ids';
export * from './supplements/screening';
export * from './supplements/inputs';
export * from './supplements/protein-gap';
export * from './supplements/eligibility';
export * from './supplements/dosage';
export * from './supplements/schedule';
export * from './supplements/claims';
export * from './supplements/notices';
export * from './supplements/text-rules';
export * from './supplements/user-data';
export * from './supplements/profile-inputs';
export * from './supplements/overview';
// Gewichtstrend, Monatsrückblick, Trainings im Handy-Kalender (docs/PLAN-TREND-RUECKBLICK-KALENDER.md).
export * from './review';
