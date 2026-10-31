// Einstieg der App: Expo Router wie bisher, dazu die Hintergrund-Aufgabe des Widgets auf dem Startbildschirm
// (nur Android, docs/PLAN-WIDGET.md 5). Browser und iPhone: register.ts tut nichts.
import 'expo-router/entry';

import { defineWearableBackground } from './src/state/use-wearables';
import { registerHomeWidget } from './src/widget/register';

registerHomeWidget();
// Abgleich im Hintergrund (nur Android, docs/PLAN-PHASE-8.md 13.6): Aufgabe beim Start des JS-Bündels bekannt machen,
// damit Android sie auch ohne geöffnete App ausführen kann. Angemeldet wird sie erst mit Einwilligung, verbundenen
// Schritten und dem Health-Connect-Recht „Daten im Hintergrund lesen“. Browser/iPhone: nichts.
defineWearableBackground();
