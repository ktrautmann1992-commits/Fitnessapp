// Einstieg der App: Expo Router wie bisher, dazu die Hintergrund-Aufgabe des Widgets auf dem Startbildschirm
// (nur Android, docs/PLAN-WIDGET.md 5). Browser und iPhone: register.ts tut nichts.
import 'expo-router/entry';

import { registerHomeWidget } from './src/widget/register';

registerHomeWidget();
