/**
 * AUTOMATISCH ERZEUGT – NICHT VON HAND BEARBEITEN.
 *
 * Quelle: packages/content/src/illustrations/ (Gelenkwinkel je Übung in poses.ts, Figuren-Rig in rig.ts).
 * Neu erzeugen: pnpm illustrations (im Hauptordner) bzw. in der Claude-Code-Sitzung „Erzeuge die Übungsbilder neu.“
 * Vorlagen enthalten Farbmarken {rolle}; die App setzt je nach Hell/Dunkel ILLUSTRATION_COLORS ein.
 */
import type { ExerciseMedia } from '@fitnessapp/core';

export type IllustrationRole =
  'figure' | 'figureFar' | 'equip' | 'equipSoft' | 'furniture' | 'furnitureLine' | 'ground' | 'gap';

export const ILLUSTRATION_COLORS: Readonly<
  Record<'light' | 'dark', Readonly<Record<IllustrationRole, string>>>
> = {
  light: {
    figure: '#262c3a',
    figureFar: '#8a93a6',
    equip: '#1f5bff',
    equipSoft: '#8db0ff',
    furniture: '#d5dbe5',
    furnitureLine: '#9aa4b8',
    ground: '#b4bdd0',
    gap: '#ffffff',
  },
  dark: {
    figure: '#e3ebff',
    figureFar: '#7d869a',
    equip: '#4d7dff',
    equipSoft: '#3b5bab',
    furniture: '#2c3342',
    furnitureLine: '#4f5a70',
    ground: '#3a4254',
    gap: '#151922',
  },
};

export interface GeneratedIllustration {
  readonly media: ExerciseMedia;
  readonly templates: { readonly start_position: string };
}

export const GENERATED_ILLUSTRATIONS: Readonly<Record<string, GeneratedIllustration>> = {
  'adduktoren-dehnen-stehend': {
    media: {
      exercise_id: 'adduktoren-dehnen-stehend',
      images: [
        {
          kind: 'start_position',
          file: 'adduktoren-dehnen-stehend-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – breiter Stand, ein Knie gebeugt, das andere Bein gestreckt, Hände an den Oberschenkeln.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="102.8,67.7 126.8,67.7 122.8,105.7 106.8,105.7" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="114.8" cy="51.7" r="9" fill="{figure}"/><line x1="108.8" y1="105.7" x2="89.3" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="89.3" y1="133.5" x2="88.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="88.2" y1="165.5" x2="83.5" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108.8" y1="105.7" x2="89.3" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="89.3" y1="133.5" x2="88.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="88.2" y1="165.5" x2="83.5" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="120.8" y1="105.7" x2="136.8" y2="135.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="136.8" y1="135.7" x2="151.8" y2="163.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="151.8" y1="163.9" x2="156.5" y2="165.6" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="120.8" y1="105.7" x2="136.8" y2="135.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="136.8" y1="135.7" x2="151.8" y2="163.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="151.8" y1="163.9" x2="156.5" y2="165.6" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="102.8" y1="68.7" x2="92.7" y2="90.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="92.7" y1="90.4" x2="90.8" y2="112.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="90.8" y1="112.3" x2="90.3" y2="117.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="102.8" y1="68.7" x2="92.7" y2="90.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="92.7" y1="90.4" x2="90.8" y2="112.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="90.8" y1="112.3" x2="90.3" y2="117.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126.8" y1="68.7" x2="134.2" y2="91.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="134.2" y1="91.5" x2="145.2" y2="110.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="145.2" y1="110.5" x2="147.7" y2="114.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126.8" y1="68.7" x2="134.2" y2="91.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="134.2" y1="91.5" x2="145.2" y2="110.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="145.2" y1="110.5" x2="147.7" y2="114.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'archer-klimmzug': {
    media: {
      exercise_id: 'archer-klimmzug',
      images: [
        {
          kind: 'start_position',
          file: 'archer-klimmzug-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – Hang an der Klimmzugstange mit sehr weitem Griff, beide Arme gestreckt, Beine geschlossen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="42" y1="9" x2="198" y2="9" stroke="{equip}" stroke-width="4" stroke-linecap="round"/><polygon points="108,48 132,48 128,86 112,86" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="114" y1="86" x2="112.8" y2="120" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="112.8" y1="120" x2="111.7" y2="152" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="111.7" y1="152" x2="111.7" y2="156.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="86" x2="112.8" y2="120" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="112.8" y1="120" x2="111.7" y2="152" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="111.7" y1="152" x2="111.7" y2="156.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="86" x2="127.2" y2="120" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="127.2" y1="120" x2="128.3" y2="152" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="128.3" y1="152" x2="128.3" y2="156.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="86" x2="127.2" y2="120" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="127.2" y1="120" x2="128.3" y2="152" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="128.3" y1="152" x2="128.3" y2="156.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="49" x2="93.2" y2="30.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="93.2" y1="30.1" x2="79.7" y2="12.8" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="79.7" y1="12.8" x2="76.6" y2="8.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="49" x2="93.2" y2="30.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="93.2" y1="30.1" x2="79.7" y2="12.8" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="79.7" y1="12.8" x2="76.6" y2="8.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="49" x2="146.8" y2="30.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="146.8" y1="30.1" x2="160.3" y2="12.8" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="160.3" y1="12.8" x2="163.4" y2="8.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="49" x2="146.8" y2="30.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="146.8" y1="30.1" x2="160.3" y2="12.8" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="160.3" y1="12.8" x2="163.4" y2="8.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="120" cy="32" r="10.6" fill="{gap}"/><circle cx="120" cy="32" r="9" fill="{figure}"/></svg>',
    },
  },
  'archer-liegestuetz': {
    media: {
      exercise_id: 'archer-liegestuetz',
      images: [
        {
          kind: 'start_position',
          file: 'archer-liegestuetz-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz von der Seite, Arme gestreckt, Hände deutlich weiter als schulterbreit, Körper vom Kopf bis zu den Fersen gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="123.3" y1="133.2" x2="91.6" y2="145.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="91.6" y1="145.3" x2="61.5" y2="156.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="61.5" y1="156.3" x2="64.3" y2="166.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="159.3" y2="144.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="159.3" y1="144.5" x2="158.9" y2="166.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="158.9" y1="166.5" x2="163.9" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="156.3,112.6 161.8,127.7 125.9,140.2 120.7,126.1" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="174.2" cy="115.1" r="9" fill="{figure}"/><line x1="123.3" y1="133.2" x2="91.4" y2="144.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="91.4" y1="144.8" x2="61.3" y2="155.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="61.3" y1="155.7" x2="64.1" y2="166.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="123.3" y1="133.2" x2="91.4" y2="144.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="91.4" y1="144.8" x2="61.3" y2="155.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="61.3" y1="155.7" x2="64.1" y2="166.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="158.1" y2="144.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="158.1" y1="144.5" x2="158.1" y2="166.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="158.1" y1="166.5" x2="163.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="158.1" y2="144.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="158.1" y1="144.5" x2="158.1" y2="166.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="158.1" y1="166.5" x2="163.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  armkreisen: {
    media: {
      exercise_id: 'armkreisen',
      images: [
        {
          kind: 'start_position',
          file: 'armkreisen-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – aufrecht stehen, Füße hüftbreit, beide Arme seitlich auf Schulterhöhe gestreckt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="108,61.5 132,61.5 128,99.5 112,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="45.5" r="9" fill="{figure}"/><line x1="114" y1="99.5" x2="115.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="115.2" y1="133.5" x2="115.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="115.2" y1="165.5" x2="110.5" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="99.5" x2="115.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="115.2" y1="133.5" x2="115.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="115.2" y1="165.5" x2="110.5" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.8" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="124.8" y1="133.5" x2="124.8" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="124.8" y1="165.5" x2="129.5" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.8" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="124.8" y1="133.5" x2="124.8" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="124.8" y1="165.5" x2="129.5" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="62.5" x2="84" y2="62.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="84" y1="62.5" x2="62" y2="62.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="62" y1="62.5" x2="57" y2="62.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="62.5" x2="84" y2="62.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="84" y1="62.5" x2="62" y2="62.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="62" y1="62.5" x2="57" y2="62.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="62.5" x2="156" y2="62.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="156" y1="62.5" x2="178" y2="62.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="178" y1="62.5" x2="183" y2="62.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="62.5" x2="156" y2="62.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="156" y1="62.5" x2="178" y2="62.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="178" y1="62.5" x2="183" y2="62.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'ausfallschritt-rueckwaerts-kurzhantel': {
    media: {
      exercise_id: 'ausfallschritt-rueckwaerts-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'ausfallschritt-rueckwaerts-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, je eine Kurzhantel seitlich an den gestreckten Armen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="122.8" y1="109.4" x2="108.8" y2="109.4" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="122.8" y1="103.9" x2="122.8" y2="114.9" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="108.8" y1="103.9" x2="108.8" y2="114.9" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="119.1" y1="99.5" x2="117.3" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="117.3" y1="133.5" x2="117.8" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="117.8" y1="165.5" x2="128.8" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="119.1" y1="62.5" x2="117" y2="86.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="117" y1="86.4" x2="115.8" y2="108.4" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="115.8" y1="108.4" x2="115.6" y2="113.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="111.1,61.5 127.1,61.5 126.6,99.5 111.6,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="119.1" cy="45.5" r="9" fill="{figure}"/><line x1="119.1" y1="99.5" x2="120.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120.2" y1="133.5" x2="119.7" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="119.7" y1="165.5" x2="130.7" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="119.1" y1="99.5" x2="120.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120.2" y1="133.5" x2="119.7" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="119.7" y1="165.5" x2="130.7" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="119.1" y1="62.5" x2="120.7" y2="86.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="120.7" y1="86.5" x2="121.5" y2="108.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="121.5" y1="108.5" x2="121.7" y2="113.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="119.1" y1="62.5" x2="120.7" y2="86.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="120.7" y1="86.5" x2="121.5" y2="108.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="121.5" y1="108.5" x2="121.7" y2="113.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="128.5" y1="109.5" x2="114.5" y2="109.5" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="128.5" y1="104" x2="128.5" y2="115" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="114.5" y1="104" x2="114.5" y2="115" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/></svg>',
    },
  },
  'australian-pull-up': {
    media: {
      exercise_id: 'australian-pull-up',
      images: [
        {
          kind: 'start_position',
          file: 'australian-pull-up-start.svg',
          alt_de:
            'Ausgangsposition: rücklings unter einer Stange auf Hüfthöhe, Hände greifen schulterbreit, Arme gestreckt, Fersen am Boden, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="192.6" y1="170" x2="192.6" y2="66" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="192.6" y1="78" x2="150.6" y2="78" stroke="{furnitureLine}" stroke-width="3" stroke-linecap="round"/><line x1="112.6" y1="138" x2="82" y2="152.9" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="82" y1="152.9" x2="53" y2="166.4" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="53" y1="166.4" x2="48.4" y2="156.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="146.4" y1="123" x2="154.7" y2="100.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="154.7" y1="100.4" x2="149.6" y2="79" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="149.6" y1="79" x2="149.6" y2="74" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="144.1,115.2 150.6,129.9 115.7,144.9 109.6,131.1" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="162.1" cy="116.5" r="9" fill="{figure}"/><line x1="112.6" y1="138" x2="81.8" y2="152.4" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="81.8" y1="152.4" x2="52.8" y2="165.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="52.8" y1="165.9" x2="48.1" y2="155.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="112.6" y1="138" x2="81.8" y2="152.4" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="81.8" y1="152.4" x2="52.8" y2="165.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="52.8" y1="165.9" x2="48.1" y2="155.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="146.4" y1="123" x2="155" y2="100.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="155" y1="100.6" x2="150.6" y2="79" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="150.6" y1="79" x2="150.6" y2="74" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="146.4" y1="123" x2="155" y2="100.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="155" y1="100.6" x2="150.6" y2="79" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="150.6" y1="79" x2="150.6" y2="74" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="150.6" cy="78" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'back-lever': {
    media: {
      exercise_id: 'back-lever',
      images: [
        {
          kind: 'start_position',
          file: 'back-lever-start.svg',
          alt_de:
            'Ausgangsposition: waagerecht unter den Ringen, Bauch nach unten, Arme gestreckt hinter dem Körper, Beine gestreckt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="143.4" y1="6" x2="145.5" y2="19.1" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="145.5" cy="19.1" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/><line x1="128.4" y1="66" x2="94.4" y2="66.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="94.4" y1="66.6" x2="62.4" y2="66.6" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="62.4" y1="66.6" x2="51.4" y2="66.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="165.4" y1="66" x2="156" y2="43.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="156" y1="43.9" x2="147.4" y2="23.7" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="147.4" y1="23.7" x2="145.5" y2="19.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="166.4,58 166.4,74 128.4,73.5 128.4,58.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="182.4" cy="67" r="9" fill="{figure}"/><line x1="128.4" y1="66" x2="94.4" y2="66" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="94.4" y1="66" x2="62.4" y2="66" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="62.4" y1="66" x2="51.4" y2="66" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.4" y1="66" x2="94.4" y2="66" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="94.4" y1="66" x2="62.4" y2="66" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="62.4" y1="66" x2="51.4" y2="66" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="165.4" y1="66" x2="156.4" y2="43.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="156.4" y1="43.7" x2="148.2" y2="23.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="148.2" y1="23.3" x2="146.3" y2="18.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="165.4" y1="66" x2="156.4" y2="43.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="156.4" y1="43.7" x2="148.2" y2="23.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="148.2" y1="23.3" x2="146.3" y2="18.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="144.4" y1="6" x2="146.3" y2="18.7" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="146.3" cy="18.7" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/></svg>',
    },
  },
  'back-lever-gehockt': {
    media: {
      exercise_id: 'back-lever-gehockt',
      images: [
        {
          kind: 'start_position',
          file: 'back-lever-gehockt-start.svg',
          alt_de:
            'Ausgangsposition: waagerecht unter den Ringen, Bauch nach unten, Arme gestreckt hinter dem Körper, Knie eng zur Brust gezogen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="109.6" y1="6" x2="111.7" y2="19.1" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="111.7" cy="19.1" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/><line x1="94.6" y1="66" x2="128.1" y2="71.9" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="128.1" y1="71.9" x2="96.2" y2="74.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="96.2" y1="74.1" x2="85.2" y2="75.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="131.6" y1="66" x2="122.2" y2="43.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="122.2" y1="43.9" x2="113.6" y2="23.7" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="113.6" y1="23.7" x2="111.7" y2="19.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="132.6,58 132.6,74 94.6,73.5 94.6,58.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="148.6" cy="67" r="9" fill="{figure}"/><line x1="94.6" y1="66" x2="128.3" y2="70.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="128.3" y1="70.7" x2="96.4" y2="73.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="96.4" y1="73.5" x2="85.4" y2="74.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="94.6" y1="66" x2="128.3" y2="70.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="128.3" y1="70.7" x2="96.4" y2="73.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="96.4" y1="73.5" x2="85.4" y2="74.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="131.6" y1="66" x2="122.6" y2="43.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="122.6" y1="43.7" x2="114.4" y2="23.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="114.4" y1="23.3" x2="112.5" y2="18.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="131.6" y1="66" x2="122.6" y2="43.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="122.6" y1="43.7" x2="114.4" y2="23.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="114.4" y1="23.3" x2="112.5" y2="18.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="110.6" y1="6" x2="112.5" y2="18.7" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="112.5" cy="18.7" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/></svg>',
    },
  },
  'bankdruecken-kurzhantel': {
    media: {
      exercise_id: 'bankdruecken-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'bankdruecken-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: auf der Flachbank liegen, Füße fest am Boden, je eine Kurzhantel seitlich der Brust, Ellbogen unter den Hanteln.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="96.9" y="144" width="4" height="26" fill="{furnitureLine}"/><rect x="168.9" y="144" width="4" height="26" fill="{furnitureLine}"/><rect x="90.9" y="138" width="88" height="7" rx="3" fill="{furnitureLine}"/><circle cx="143.9" cy="117" r="6" fill="{equip}"/><circle cx="143.9" cy="117" r="2" fill="{equipSoft}"/><line x1="112.9" y1="128" x2="79.6" y2="134.8" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="79.6" y1="134.8" x2="74.9" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="74.9" y1="166.5" x2="63.9" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="149.9" y1="128" x2="126.1" y2="130.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="126.1" y1="130.9" x2="143.9" y2="118" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="143.9" y1="118" x2="143.9" y2="113" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="150.9,120 150.9,136 112.9,135.5 112.9,120.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="166.9" cy="128" r="9" fill="{figure}"/><line x1="112.9" y1="128" x2="79.5" y2="134.6" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="79.5" y1="134.6" x2="76.9" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="76.9" y1="166.5" x2="65.9" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="112.9" y1="128" x2="79.5" y2="134.6" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="79.5" y1="134.6" x2="76.9" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="76.9" y1="166.5" x2="65.9" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="149.9" y1="128" x2="125.9" y2="129.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="125.9" y1="129.1" x2="144.9" y2="118" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="144.9" y1="118" x2="144.9" y2="113" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="149.9" y1="128" x2="125.9" y2="129.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="125.9" y1="129.1" x2="144.9" y2="118" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="144.9" y1="118" x2="144.9" y2="113" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="144.9" cy="117" r="6" fill="{equip}"/><circle cx="144.9" cy="117" r="2" fill="{equipSoft}"/></svg>',
    },
  },
  'bankdruecken-langhantel': {
    media: {
      exercise_id: 'bankdruecken-langhantel',
      images: [
        {
          kind: 'start_position',
          file: 'bankdruecken-langhantel-start.svg',
          alt_de:
            'Ausgangsposition: auf der Flachbank liegen, Füße fest am Boden, Langhantel mit gestreckten Armen über den Schultern; dahinter die Ablage.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="176.1" y1="170" x2="176.1" y2="70" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><polyline points="170.1,78 182.1,78 182.1,73" fill="none" stroke="{furnitureLine}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="92.1" y="144" width="4" height="26" fill="{furnitureLine}"/><rect x="164.1" y="144" width="4" height="26" fill="{furnitureLine}"/><rect x="86.1" y="138" width="88" height="7" rx="3" fill="{furnitureLine}"/><line x1="108.1" y1="128" x2="74.8" y2="134.8" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="74.8" y1="134.8" x2="70.1" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="70.1" y1="166.5" x2="59.1" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="145.1" y1="128" x2="144.7" y2="104" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="144.7" y1="104" x2="144.7" y2="82" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="144.7" y1="82" x2="144.7" y2="77" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="146.1,120 146.1,136 108.1,135.5 108.1,120.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="162.1" cy="128" r="9" fill="{figure}"/><line x1="108.1" y1="128" x2="74.8" y2="134.6" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="74.8" y1="134.6" x2="72.1" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="72.1" y1="166.5" x2="61.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108.1" y1="128" x2="74.8" y2="134.6" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="74.8" y1="134.6" x2="72.1" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="72.1" y1="166.5" x2="61.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="145.1" y1="128" x2="145.1" y2="104" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="145.1" y1="104" x2="145.1" y2="82" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="145.1" y1="82" x2="145.1" y2="77" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="145.1" y1="128" x2="145.1" y2="104" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="145.1" y1="104" x2="145.1" y2="82" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="145.1" y1="82" x2="145.1" y2="77" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="145.1" cy="81" r="14" fill="none" stroke="{equip}" stroke-width="3.5"/><circle cx="145.1" cy="81" r="3" fill="{equip}"/></svg>',
    },
  },
  'beinbeuger-band': {
    media: {
      exercise_id: 'beinbeuger-band',
      images: [
        {
          kind: 'start_position',
          file: 'beinbeuger-band-start.svg',
          alt_de:
            'Ausgangsposition: Bauchlage, Beine gestreckt, Kopf auf den Unterarmen, Widerstandsband um ein Fußgelenk, am Tischbein hinter den Füßen befestigt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="37.9" y1="170" x2="37.9" y2="126" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="11.9" y1="126" x2="41.9" y2="126" stroke="{furnitureLine}" stroke-width="6" stroke-linecap="round"/><line x1="141.9" y1="157.5" x2="107.9" y2="158.1" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="107.9" y1="158.1" x2="75.9" y2="158.7" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="75.9" y1="158.7" x2="65.5" y2="162.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="178.8" y1="156.2" x2="200.8" y2="166" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="200.8" y1="166" x2="222.7" y2="164.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="222.7" y1="164.5" x2="227.7" y2="164.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="179.6,148.2 180.1,164.2 142.1,165 141.6,150" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="195.4" cy="152.7" r="9" fill="{figure}"/><line x1="141.9" y1="157.5" x2="107.9" y2="158.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="107.9" y1="158.7" x2="75.9" y2="158.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="75.9" y1="158.7" x2="65.5" y2="162.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="141.9" y1="157.5" x2="107.9" y2="158.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="107.9" y1="158.7" x2="75.9" y2="158.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="75.9" y1="158.7" x2="65.5" y2="162.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="178.8" y1="156.2" x2="201.4" y2="164.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="201.4" y1="164.4" x2="223.4" y2="164.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="223.4" y1="164.4" x2="228.4" y2="164.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="178.8" y1="156.2" x2="201.4" y2="164.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="201.4" y1="164.4" x2="223.4" y2="164.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="223.4" y1="164.4" x2="228.4" y2="164.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="75.9" y1="158.7" x2="39.9" y2="164" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
  },
  'beinbeuger-handtuch': {
    media: {
      exercise_id: 'beinbeuger-handtuch',
      images: [
        {
          kind: 'start_position',
          file: 'beinbeuger-handtuch-start.svg',
          alt_de:
            'Ausgangsposition: Rückenlage, Becken angehoben, sodass Schultern, Hüfte und Knie eine Linie bilden, Fersen auf einem gefalteten Handtuch.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="71.9" y="167" width="26" height="3" rx="1.5" fill="{equipSoft}"/><line x1="109.9" y1="142" x2="77.2" y2="132.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="77.2" y1="132.7" x2="83.9" y2="164" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="83.9" y1="164" x2="81.9" y2="153.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="142.8" y1="158.8" x2="119.1" y2="162.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="119.1" y1="162.6" x2="97.1" y2="162.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="97.1" y1="162.6" x2="92.1" y2="162.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="147.3,152.1 140.1,166.4 106.5,148.7 113.3,135.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="159.5" cy="160.2" r="9" fill="{figure}"/><line x1="109.9" y1="142" x2="77" y2="133.2" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="77" y1="133.2" x2="85.9" y2="164" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="85.9" y1="164" x2="83.9" y2="153.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="109.9" y1="142" x2="77" y2="133.2" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="77" y1="133.2" x2="85.9" y2="164" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="85.9" y1="164" x2="83.9" y2="153.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="142.8" y1="158.8" x2="119.2" y2="163" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="119.2" y1="163" x2="97.2" y2="163" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="97.2" y1="163" x2="92.2" y2="163" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="142.8" y1="158.8" x2="119.2" y2="163" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="119.2" y1="163" x2="97.2" y2="163" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="97.2" y1="163" x2="92.2" y2="163" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'beinbeuger-maschine': {
    media: {
      exercise_id: 'beinbeuger-maschine',
      images: [
        {
          kind: 'start_position',
          file: 'beinbeuger-maschine-start.svg',
          alt_de:
            'Ausgangsposition: an der Beinbeuger-Maschine sitzen, Beine gestreckt, Polster über den Oberschenkeln und hinter den Fersen, Hände an den Griffen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="94.6" y="140" width="22" height="30" fill="{furniture}"/><rect x="84.6" y="134" width="46" height="6" rx="3" fill="{furnitureLine}"/><line x1="82.6" y1="132" x2="72.6" y2="74" stroke="{furnitureLine}" stroke-width="7" stroke-linecap="round"/><line x1="100.6" y1="128" x2="134.6" y2="127.4" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="134.6" y1="127.4" x2="165.8" y2="134.6" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="165.8" y1="134.6" x2="168" y2="123.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="94.2" y1="91.6" x2="95.3" y2="115.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="95.3" y1="115.5" x2="115.6" y2="124" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="115.6" y1="124" x2="119.4" y2="127.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="86.1,92 101.9,89.2 108,126.7 93.2,129.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="91.2" cy="74.8" r="9" fill="{figure}"/><line x1="100.6" y1="128" x2="134.6" y2="128" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="134.6" y1="128" x2="165.9" y2="134.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="165.9" y1="134.7" x2="168.2" y2="123.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="100.6" y1="128" x2="134.6" y2="128" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="134.6" y1="128" x2="165.9" y2="134.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="165.9" y1="134.7" x2="168.2" y2="123.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="94.2" y1="91.6" x2="96.3" y2="115.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="96.3" y1="115.5" x2="116.6" y2="124" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="116.6" y1="124" x2="120.4" y2="127.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="94.2" y1="91.6" x2="96.3" y2="115.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="96.3" y1="115.5" x2="116.6" y2="124" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="116.6" y1="124" x2="120.4" y2="127.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="128.6" cy="118" r="6" fill="{furnitureLine}"/><line x1="136.6" y1="128" x2="165.9" y2="142.7" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><circle cx="165.9" cy="143.7" r="5" fill="{furnitureLine}"/><circle cx="116.6" cy="124" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'beinpendel-stehend': {
    media: {
      exercise_id: 'beinpendel-stehend',
      images: [
        {
          kind: 'start_position',
          file: 'beinpendel-stehend-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht neben einer Wand stehen, eine Hand an der Wand, das freie Bein locker leicht nach vorn gependelt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="144.3" y="20" width="8" height="150" fill="{furniture}"/><line x1="98.3" y1="99.5" x2="109.9" y2="131.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="109.9" y1="131.5" x2="119.8" y2="161.9" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="119.8" y1="161.9" x2="130.8" y2="161.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.3" y1="62.5" x2="102.4" y2="86.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="102.4" y1="86.1" x2="103.2" y2="108.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="103.2" y1="108.1" x2="103.4" y2="113.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="90.3,61.5 106.3,61.5 105.8,99.5 90.8,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="98.3" cy="45.5" r="9" fill="{figure}"/><line x1="98.3" y1="99.5" x2="98.8" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="98.8" y1="133.5" x2="98.8" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="98.8" y1="165.5" x2="109.8" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.3" y1="99.5" x2="98.8" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="98.8" y1="133.5" x2="98.8" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="98.8" y1="165.5" x2="109.8" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.3" y1="62.5" x2="121.7" y2="67.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="121.7" y1="67.5" x2="143.7" y2="66.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="143.7" y1="66.7" x2="144.6" y2="61.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.3" y1="62.5" x2="121.7" y2="67.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="121.7" y1="67.5" x2="143.7" y2="66.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="143.7" y1="66.7" x2="144.6" y2="61.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  beinpresse: {
    media: {
      exercise_id: 'beinpresse',
      images: [
        {
          kind: 'start_position',
          file: 'beinpresse-start.svg',
          alt_de:
            'Ausgangsposition: in der Beinpresse liegen, Rücken und Gesäß am Polster, Füße hüftbreit auf der Plattform, Beine fast gestreckt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="65.7" y="152" width="50" height="18" rx="2" fill="{furniture}"/><line x1="89.7" y1="150" x2="55.7" y2="116" stroke="{furnitureLine}" stroke-width="7" stroke-linecap="round"/><line x1="105.7" y1="170" x2="187.7" y2="88" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><line x1="132.7" y1="90" x2="150.7" y2="110" stroke="{equip}" stroke-width="6" stroke-linecap="round"/><line x1="95.7" y1="140" x2="122.1" y2="118.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="122.1" y1="118.6" x2="143.9" y2="95.2" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="143.9" y1="95.2" x2="136" y2="87.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="69.5" y1="113.8" x2="86.4" y2="130.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="86.4" y1="130.9" x2="102.6" y2="145.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="102.6" y1="145.9" x2="107.6" y2="145.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="63.2,118.8 74.5,107.5 101,134.7 90.4,145.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="58.8" cy="100.7" r="9" fill="{figure}"/><line x1="95.7" y1="140" x2="122.5" y2="119.1" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="122.5" y1="119.1" x2="144.7" y2="96" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="144.7" y1="96" x2="136.8" y2="88.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="95.7" y1="140" x2="122.5" y2="119.1" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="122.5" y1="119.1" x2="144.7" y2="96" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="144.7" y1="96" x2="136.8" y2="88.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="69.5" y1="113.8" x2="86.7" y2="130.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="86.7" y1="130.6" x2="103" y2="145.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="103" y1="145.4" x2="108" y2="145.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="69.5" y1="113.8" x2="86.7" y2="130.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="86.7" y1="130.6" x2="103" y2="145.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="103" y1="145.4" x2="108" y2="145.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="103" cy="145.4" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'beinrueckseite-dehnen-sitzend': {
    media: {
      exercise_id: 'beinrueckseite-dehnen-sitzend',
      images: [
        {
          kind: 'start_position',
          file: 'beinrueckseite-dehnen-sitzend-start.svg',
          alt_de:
            'Ausgangsposition: auf der vorderen Kante eines Stuhls sitzen, ein Bein gestreckt mit der Ferse am Boden, das andere Knie gebeugt, Rücken gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="82" y1="170" x2="82" y2="103" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="110" y1="170" x2="110" y2="137" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="82" y1="137" x2="110" y2="137" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><line x1="104" y1="129" x2="137.5" y2="134.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="137.5" y1="134.6" x2="135" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="135" y1="166.5" x2="146" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="110.4" y1="92.6" x2="121.7" y2="113.8" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="121.7" y1="113.8" x2="132" y2="133.2" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="132" y1="133.2" x2="134.4" y2="137.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="102.7,90.2 118.5,93 111.4,130.3 96.6,127.7" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="113.4" cy="75.8" r="9" fill="{figure}"/><line x1="104" y1="129" x2="135.4" y2="142" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="135.4" y1="142" x2="156" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="156" y1="166.5" x2="156" y2="155.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="104" y1="129" x2="135.4" y2="142" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="135.4" y1="142" x2="156" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="156" y1="166.5" x2="156" y2="155.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="110.4" y1="92.6" x2="122.4" y2="113.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="122.4" y1="113.3" x2="133.4" y2="132.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="133.4" y1="132.4" x2="135.9" y2="136.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="110.4" y1="92.6" x2="122.4" y2="113.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="122.4" y1="113.3" x2="133.4" y2="132.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="133.4" y1="132.4" x2="135.9" y2="136.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  beinstrecker: {
    media: {
      exercise_id: 'beinstrecker',
      images: [
        {
          kind: 'start_position',
          file: 'beinstrecker-start.svg',
          alt_de:
            'Ausgangsposition: an der Beinstrecker-Maschine sitzen, Knie gebeugt, Fußpolster vorn knapp über den Fußgelenken, Hände an den Griffen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="103.8" y="140" width="22" height="30" fill="{furniture}"/><rect x="93.8" y="134" width="46" height="6" rx="3" fill="{furnitureLine}"/><line x1="93.8" y1="130" x2="85.8" y2="74" stroke="{furnitureLine}" stroke-width="7" stroke-linecap="round"/><line x1="109.8" y1="128" x2="143.5" y2="124" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="143.5" y1="124" x2="141.8" y2="156" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="141.8" y1="156" x2="152.6" y2="154.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="104.6" y1="91.4" x2="104.3" y2="115.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="104.3" y1="115.4" x2="120.8" y2="130" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="120.8" y1="130" x2="123.3" y2="134.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="96.5,91.5 112.4,89.3 117.2,127 102.3,129" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="102.2" cy="74.5" r="9" fill="{figure}"/><line x1="109.8" y1="128" x2="143.5" y2="124" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="143.5" y1="124" x2="143.8" y2="156" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="143.8" y1="156" x2="154.6" y2="154.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="109.8" y1="128" x2="143.5" y2="124" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="143.5" y1="124" x2="143.8" y2="156" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="143.8" y1="156" x2="154.6" y2="154.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="104.6" y1="91.4" x2="105.3" y2="115.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="105.3" y1="115.3" x2="121.8" y2="130" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="121.8" y1="130" x2="124.3" y2="134.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="104.6" y1="91.4" x2="105.3" y2="115.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="105.3" y1="115.3" x2="121.8" y2="130" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="121.8" y1="130" x2="124.3" y2="134.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="145.5" y1="124" x2="151.8" y2="154" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><circle cx="152.8" cy="153" r="5" fill="{furnitureLine}"/><circle cx="121.8" cy="130" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'beinstrecker-band': {
    media: {
      exercise_id: 'beinstrecker-band',
      images: [
        {
          kind: 'start_position',
          file: 'beinstrecker-band-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht auf einem Stuhl sitzen, Knie im rechten Winkel, Widerstandsband vom Fußgelenk zum Stuhlbein, Hände halten sich seitlich fest.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="86.9" y1="170" x2="86.9" y2="103" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="114.9" y1="170" x2="114.9" y2="137" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="86.9" y1="137" x2="114.9" y2="137" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><line x1="108.9" y1="129" x2="142.9" y2="129.1" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="142.9" y1="129.1" x2="139.9" y2="161" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="139.9" y1="161" x2="150.9" y2="161" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="107.6" y1="92" x2="98.8" y2="114.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="98.8" y1="114.3" x2="111.9" y2="132" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="111.9" y1="132" x2="111.9" y2="137" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="99.6,91.3 115.5,90.7 116.4,128.7 101.4,129.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="107" cy="75" r="9" fill="{figure}"/><line x1="108.9" y1="129" x2="142.9" y2="129" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="142.9" y1="129" x2="141.9" y2="161" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="141.9" y1="161" x2="152.9" y2="161" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108.9" y1="129" x2="142.9" y2="129" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="142.9" y1="129" x2="141.9" y2="161" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="141.9" y1="161" x2="152.9" y2="161" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="107.6" y1="92" x2="99.4" y2="114.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="99.4" y1="114.6" x2="112.9" y2="132" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="112.9" y1="132" x2="112.9" y2="137" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="107.6" y1="92" x2="99.4" y2="114.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="99.4" y1="114.6" x2="112.9" y2="132" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="112.9" y1="132" x2="112.9" y2="137" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="141.9" y1="161" x2="114.9" y2="164" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
  },
  'bird-dog': {
    media: {
      exercise_id: 'bird-dog',
      images: [
        {
          kind: 'start_position',
          file: 'bird-dog-start.svg',
          alt_de:
            'Ausgangsposition: Vierfüßlerstand, Hände unter den Schultern, Knie unter der Hüfte, Rücken gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="113" y1="130.5" x2="111.8" y2="164.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="111.8" y1="164.5" x2="79.8" y2="164.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="79.8" y1="164.5" x2="68.8" y2="164.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.6" y1="120.3" x2="149.4" y2="144.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="149.4" y1="144.3" x2="148.7" y2="166.3" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="148.7" y1="166.3" x2="153.7" y2="166.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="147.3,112.3 151.7,127.7 115.1,137.7 110.9,123.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="164.9" cy="115.6" r="9" fill="{figure}"/><line x1="113" y1="130.5" x2="113" y2="164.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="113" y1="164.5" x2="81" y2="164.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="81" y1="164.5" x2="70" y2="164.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="113" y1="130.5" x2="113" y2="164.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="113" y1="164.5" x2="81" y2="164.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="81" y1="164.5" x2="70" y2="164.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.6" y1="120.3" x2="148.6" y2="144.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="148.6" y1="144.3" x2="148.6" y2="166.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="148.6" y1="166.3" x2="153.6" y2="166.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="148.6" y1="120.3" x2="148.6" y2="144.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="148.6" y1="144.3" x2="148.6" y2="166.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="148.6" y1="166.3" x2="153.6" y2="166.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'bizepscurl-band': {
    media: {
      exercise_id: 'bizepscurl-band',
      images: [
        {
          kind: 'start_position',
          file: 'bizepscurl-band-start.svg',
          alt_de:
            'Ausgangsposition: mit beiden Füßen auf dem Widerstandsband stehen, die Enden mit gestreckten Armen greifen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="118.1" y1="99.5" x2="116.3" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="116.3" y1="133.5" x2="116.8" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="116.8" y1="165.5" x2="127.8" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="116.8" y2="86.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="116.8" y1="86.5" x2="116" y2="108.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="116" y1="108.5" x2="116" y2="113.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="110.1,61.5 126.1,61.5 125.6,99.5 110.6,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="118.1" cy="45.5" r="9" fill="{figure}"/><line x1="118.1" y1="99.5" x2="119.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="119.2" y1="133.5" x2="118.7" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="118.7" y1="165.5" x2="129.7" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="99.5" x2="119.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="119.2" y1="133.5" x2="118.7" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="118.7" y1="165.5" x2="129.7" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="118.9" y2="86.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="118.9" y1="86.5" x2="119.7" y2="108.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="119.7" y1="108.5" x2="119.8" y2="113.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="118.9" y2="86.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="118.9" y1="86.5" x2="119.7" y2="108.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="119.7" y1="108.5" x2="119.8" y2="113.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="123.7" y1="167.5" x2="119.7" y2="108.5" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
  },
  'bizepscurl-kurzhantel': {
    media: {
      exercise_id: 'bizepscurl-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'bizepscurl-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, je eine Kurzhantel an gestreckten Armen, Handflächen nach vorn.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><circle cx="116" cy="107.5" r="6" fill="{equip}"/><circle cx="116" cy="107.5" r="2" fill="{equipSoft}"/><line x1="118.1" y1="99.5" x2="116.3" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="116.3" y1="133.5" x2="116.8" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="116.8" y1="165.5" x2="127.8" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="116.8" y2="86.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="116.8" y1="86.5" x2="116" y2="108.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="116" y1="108.5" x2="116" y2="113.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="110.1,61.5 126.1,61.5 125.6,99.5 110.6,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="118.1" cy="45.5" r="9" fill="{figure}"/><line x1="118.1" y1="99.5" x2="119.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="119.2" y1="133.5" x2="118.7" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="118.7" y1="165.5" x2="129.7" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="99.5" x2="119.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="119.2" y1="133.5" x2="118.7" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="118.7" y1="165.5" x2="129.7" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="118.9" y2="86.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="118.9" y1="86.5" x2="119.7" y2="108.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="119.7" y1="108.5" x2="119.8" y2="113.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="118.9" y2="86.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="118.9" y1="86.5" x2="119.7" y2="108.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="119.7" y1="108.5" x2="119.8" y2="113.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="119.7" cy="107.5" r="6" fill="{equip}"/><circle cx="119.7" cy="107.5" r="2" fill="{equipSoft}"/></svg>',
    },
  },
  'bodendruecken-kurzhantel': {
    media: {
      exercise_id: 'bodendruecken-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'bodendruecken-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: Rückenlage am Boden, Knie gebeugt, Füße aufgestellt, je eine Kurzhantel mit gestreckten Armen über der Brust.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><circle cx="148" cy="113" r="6" fill="{equip}"/><circle cx="148" cy="113" r="2" fill="{equipSoft}"/><line x1="111.4" y1="160" x2="87.7" y2="135.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="87.7" y1="135.6" x2="79.4" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="79.4" y1="166.5" x2="68.4" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.4" y1="160" x2="148" y2="136" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="148" y1="136" x2="148" y2="114" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="148" y1="114" x2="148" y2="109" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="149.4,152 149.4,168 111.4,167.5 111.4,152.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="165.4" cy="159.5" r="9" fill="{figure}"/><line x1="111.4" y1="160" x2="88.1" y2="135.2" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="88.1" y1="135.2" x2="81.4" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="81.4" y1="166.5" x2="70.4" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="111.4" y1="160" x2="88.1" y2="135.2" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="88.1" y1="135.2" x2="81.4" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="81.4" y1="166.5" x2="70.4" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.4" y1="160" x2="148.4" y2="136" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="148.4" y1="136" x2="148.4" y2="114" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="148.4" y1="114" x2="148.4" y2="109" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="148.4" y1="160" x2="148.4" y2="136" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="148.4" y1="136" x2="148.4" y2="114" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="148.4" y1="114" x2="148.4" y2="109" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="148.4" cy="113" r="6" fill="{equip}"/><circle cx="148.4" cy="113" r="2" fill="{equipSoft}"/></svg>',
    },
  },
  'brustdehnung-tuerrahmen': {
    media: {
      exercise_id: 'brustdehnung-tuerrahmen',
      images: [
        {
          kind: 'start_position',
          file: 'brustdehnung-tuerrahmen-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht im Türrahmen stehen, ein Oberarm auf Schulterhöhe nach hinten, der Unterarm senkrecht am Rahmen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="94.8" y="20" width="7" height="150" fill="{furniture}"/><line x1="130.8" y1="99.5" x2="129" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="129" y1="133.5" x2="129.6" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="129.6" y1="165.5" x2="140.6" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.8" y1="62.5" x2="128.7" y2="86.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="128.7" y1="86.4" x2="127.6" y2="108.4" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="127.6" y1="108.4" x2="127.3" y2="113.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122.8,61.5 138.8,61.5 138.3,99.5 123.3,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="130.8" cy="45.5" r="9" fill="{figure}"/><line x1="130.8" y1="99.5" x2="132" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="132" y1="133.5" x2="131.4" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="131.4" y1="165.5" x2="142.4" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.8" y1="99.5" x2="132" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="132" y1="133.5" x2="131.4" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="131.4" y1="165.5" x2="142.4" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.8" y1="62.5" x2="106.8" y2="62.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="106.8" y1="62.5" x2="106.8" y2="40.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="106.8" y1="40.5" x2="106.8" y2="35.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.8" y1="62.5" x2="106.8" y2="62.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="106.8" y1="62.5" x2="106.8" y2="40.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="106.8" y1="40.5" x2="106.8" y2="35.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'brustdruecken-band': {
    media: {
      exercise_id: 'brustdruecken-band',
      images: [
        {
          kind: 'start_position',
          file: 'brustdruecken-band-start.svg',
          alt_de:
            'Ausgangsposition: Schrittstellung, Widerstandsband an einem Türanker hinter dir, Hände halten die Enden seitlich der Brust.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="79.4" y="20" width="7" height="150" fill="{furniture}"/><line x1="152.2" y1="79.1" x2="86.4" y2="78" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/><line x1="141.4" y1="98.3" x2="133.2" y2="131.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="133.2" y1="131.3" x2="139.9" y2="162.6" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="139.9" y1="162.6" x2="149.8" y2="167.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="144" y1="61.4" x2="129.2" y2="80.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="129.2" y1="80.3" x2="151.2" y2="79.2" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="151.2" y1="79.2" x2="156.2" y2="78.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="136.1,59.8 152.1,61 148.9,98.8 133.9,97.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="144.7" cy="44.4" r="9" fill="{figure}"/><line x1="141.4" y1="98.3" x2="148.5" y2="131.6" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="148.5" y1="131.6" x2="146.8" y2="163.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="146.8" y1="163.5" x2="157.8" y2="163.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="141.4" y1="98.3" x2="148.5" y2="131.6" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="148.5" y1="131.6" x2="146.8" y2="163.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="146.8" y1="163.5" x2="157.8" y2="163.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="144" y1="61.4" x2="130.2" y2="81.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="130.2" y1="81.1" x2="152.2" y2="79.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="152.2" y1="79.1" x2="157.1" y2="78.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="144" y1="61.4" x2="130.2" y2="81.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="130.2" y1="81.1" x2="152.2" y2="79.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="152.2" y1="79.1" x2="157.1" y2="78.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  brustpresse: {
    media: {
      exercise_id: 'brustpresse',
      images: [
        {
          kind: 'start_position',
          file: 'brustpresse-start.svg',
          alt_de:
            'Ausgangsposition: an der Brustpresse sitzen, Rücken an der Lehne, Griffe auf Höhe der Brustmitte fassen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="103.3" y="140" width="22" height="30" fill="{furniture}"/><rect x="93.3" y="134" width="40" height="6" rx="3" fill="{furnitureLine}"/><line x1="94.3" y1="130" x2="90.3" y2="66" stroke="{furnitureLine}" stroke-width="7" stroke-linecap="round"/><line x1="121.3" y1="92" x2="151.3" y2="58" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="109.3" y1="128" x2="142.5" y2="134.9" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="142.5" y1="134.9" x2="137.3" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="137.3" y1="166.5" x2="148.3" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="106" y1="91.1" x2="104.2" y2="115.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="104.2" y1="115.1" x2="120.3" y2="100" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="120.3" y1="100" x2="120.3" y2="95" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="98,90.8 113.9,89.4 116.7,127.3 101.8,128.7" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="104.5" cy="74.2" r="9" fill="{figure}"/><line x1="109.3" y1="128" x2="142.6" y2="134.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="142.6" y1="134.7" x2="139.3" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="139.3" y1="166.5" x2="150.3" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="109.3" y1="128" x2="142.6" y2="134.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="142.6" y1="134.7" x2="139.3" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="139.3" y1="166.5" x2="150.3" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="106" y1="91.1" x2="105.3" y2="115.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="105.3" y1="115.1" x2="121.3" y2="100" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="121.3" y1="100" x2="121.3" y2="95" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="106" y1="91.1" x2="105.3" y2="115.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="105.3" y1="115.1" x2="121.3" y2="100" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="121.3" y1="100" x2="121.3" y2="95" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="121.3" y1="106" x2="121.3" y2="92" stroke="{equip}" stroke-width="4" stroke-linecap="round"/></svg>',
    },
  },
  'bulgarische-split-kniebeuge': {
    media: {
      exercise_id: 'bulgarische-split-kniebeuge',
      images: [
        {
          kind: 'start_position',
          file: 'bulgarische-split-kniebeuge-start.svg',
          alt_de:
            'Ausgangsposition: vor einer Flachbank stehen, Spann des hinteren Fußes liegt auf der Bank, vorderer Fuß weit vorn, je eine Kurzhantel seitlich.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="54.1" y="144" width="4" height="26" fill="{furnitureLine}"/><rect x="106.1" y="144" width="4" height="26" fill="{furnitureLine}"/><rect x="48.1" y="138" width="68" height="7" rx="3" fill="{furnitureLine}"/><line x1="153.1" y1="120" x2="139.1" y2="120" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="153.1" y1="114.5" x2="153.1" y2="125.5" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="139.1" y1="114.5" x2="139.1" y2="125.5" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="148.1" y1="110" x2="138.8" y2="142.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="138.8" y1="142.7" x2="108.1" y2="133.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="108.1" y1="133.5" x2="97.2" y2="134.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.1" y1="73" x2="146.9" y2="97" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="146.9" y1="97" x2="146.1" y2="119" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="146.1" y1="119" x2="145.9" y2="124" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="140.1,72 156.1,72 155.6,110 140.6,110" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="148.1" cy="56" r="9" fill="{figure}"/><line x1="148.1" y1="110" x2="170.8" y2="135.4" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="170.8" y1="135.4" x2="178.1" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="178.1" y1="166.5" x2="189.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="148.1" y1="110" x2="170.8" y2="135.4" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="170.8" y1="135.4" x2="178.1" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="178.1" y1="166.5" x2="189.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.1" y1="73" x2="149" y2="97" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="149" y1="97" x2="149.3" y2="119" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="149.3" y1="119" x2="149.4" y2="124" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="148.1" y1="73" x2="149" y2="97" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="149" y1="97" x2="149.3" y2="119" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="149.3" y1="119" x2="149.4" y2="124" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="156.3" y1="120" x2="142.3" y2="120" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="156.3" y1="114.5" x2="156.3" y2="125.5" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="142.3" y1="114.5" x2="142.3" y2="125.5" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/></svg>',
    },
  },
  'bulgarische-split-kniebeuge-stuhl': {
    media: {
      exercise_id: 'bulgarische-split-kniebeuge-stuhl',
      images: [
        {
          kind: 'start_position',
          file: 'bulgarische-split-kniebeuge-stuhl-start.svg',
          alt_de:
            'Ausgangsposition: seitlich nah an einer Wand stehen, eine Hand an der Wand, Fußrücken des hinteren Beins auf der Stuhlsitzfläche, vorderer Fuß weit vorn.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="57.1" y="30" width="124" height="140" rx="3" fill="{furniture}"/><line x1="65.1" y1="170" x2="65.1" y2="103" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="93.1" y1="170" x2="93.1" y2="137" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="65.1" y1="137" x2="93.1" y2="137" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><line x1="141.1" y1="110" x2="126" y2="140.4" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="126" y1="140.4" x2="95.1" y2="132" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="95.1" y1="132" x2="84.2" y2="133" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="141.1" y1="73" x2="153.1" y2="93.8" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="153.1" y1="93.8" x2="160.6" y2="114.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="160.6" y1="114.5" x2="162.4" y2="119.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="133.1,72 149.1,72 148.6,110 133.6,110" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="141.1" cy="56" r="9" fill="{figure}"/><line x1="141.1" y1="110" x2="164.3" y2="134.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="164.3" y1="134.9" x2="169.1" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="169.1" y1="166.5" x2="180.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="141.1" y1="110" x2="164.3" y2="134.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="164.3" y1="134.9" x2="169.1" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="169.1" y1="166.5" x2="180.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="141.1" y1="73" x2="142.8" y2="96.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="142.8" y1="96.9" x2="143.6" y2="118.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="143.6" y1="118.9" x2="143.7" y2="123.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="141.1" y1="73" x2="142.8" y2="96.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="142.8" y1="96.9" x2="143.6" y2="118.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="143.6" y1="118.9" x2="143.7" y2="123.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'chin-up': {
    media: {
      exercise_id: 'chin-up',
      images: [
        {
          kind: 'start_position',
          file: 'chin-up-start.svg',
          alt_de:
            'Ausgangsposition: gestreckter Hang an der Klimmzugstange im Untergriff, Handflächen zeigen zum Körper, Füße über dem Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="123.7,6 123.7,6.5 137.7,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="128.5" y2="131.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="128.5" y1="131.7" x2="102.3" y2="150.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="102.3" y1="150.1" x2="100.4" y2="160.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132" y2="37.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="132" y1="37.1" x2="132.4" y2="15.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="132.4" y1="15.1" x2="132.6" y2="10.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122.7,60.5 138.7,59.6 140.2,97.6 125.2,98.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="129.8" cy="44.1" r="10.6" fill="{gap}"/><circle cx="129.8" cy="44.1" r="9" fill="{figure}"/><circle cx="137.7" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'copenhagen-seitstuetz-knie': {
    media: {
      exercise_id: 'copenhagen-seitstuetz-knie',
      images: [
        {
          kind: 'start_position',
          file: 'copenhagen-seitstuetz-knie-start.svg',
          alt_de:
            'Ausgangsposition: Seitstütz von vorn, Ellbogen unter der Schulter, das obere Knie liegt auf einer Bank, das untere Bein hängt frei, Hüfte angehoben.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="50.3" y="146" width="14" height="24" fill="{furniture}"/><rect x="46.3" y="140" width="22" height="7" rx="3" fill="{furnitureLine}"/><polygon points="166.3,110.7 172.1,134 134.2,139.3 130.4,123.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="184.7" cy="118.5" r="9" fill="{figure}"/><line x1="130.9" y1="125.7" x2="97.9" y2="133.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="97.9" y1="133.9" x2="66.8" y2="141.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="66.8" y1="141.7" x2="62" y2="142.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.9" y1="125.7" x2="97.9" y2="133.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="97.9" y1="133.9" x2="66.8" y2="141.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="66.8" y1="141.7" x2="62" y2="142.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="133.8" y1="137.3" x2="100.8" y2="145.6" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="100.8" y1="145.6" x2="100.8" y2="155.2" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="100.8" y1="155.2" x2="100.8" y2="160.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="133.8" y1="137.3" x2="100.8" y2="145.6" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="100.8" y1="145.6" x2="100.8" y2="155.2" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="100.8" y1="155.2" x2="100.8" y2="160.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="165.3" y1="110.9" x2="166.1" y2="86.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="166.1" y1="86.9" x2="166.1" y2="64.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="166.1" y1="64.9" x2="166.1" y2="59.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="165.3" y1="110.9" x2="166.1" y2="86.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="166.1" y1="86.9" x2="166.1" y2="64.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="166.1" y1="64.9" x2="166.1" y2="59.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="171.1" y1="134.2" x2="171.1" y2="158.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="171.1" y1="158.2" x2="174.2" y2="164" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="174.2" y1="164" x2="178" y2="167.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="171.1" y1="134.2" x2="171.1" y2="158.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="171.1" y1="158.2" x2="174.2" y2="164" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="174.2" y1="164" x2="178" y2="167.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'dead-bug': {
    media: {
      exercise_id: 'dead-bug',
      images: [
        {
          kind: 'start_position',
          file: 'dead-bug-start.svg',
          alt_de:
            'Ausgangsposition: Rückenlage, Arme senkrecht nach oben, Hüfte und Knie im rechten Winkel, Unterschenkel waagerecht.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="107.4" y1="159.5" x2="106.2" y2="125.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="106.2" y1="125.5" x2="74.2" y2="126.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="74.2" y1="126.1" x2="72.3" y2="115.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="144.4" y1="159.5" x2="144" y2="135.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="144" y1="135.5" x2="144" y2="113.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="144" y1="113.5" x2="144" y2="108.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="145.4,151.5 145.4,167.5 107.4,167 107.4,152" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="161.4" cy="159" r="9" fill="{figure}"/><line x1="107.4" y1="159.5" x2="107.4" y2="125.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="107.4" y1="125.5" x2="75.4" y2="125.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="75.4" y1="125.5" x2="73.5" y2="114.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="107.4" y1="159.5" x2="107.4" y2="125.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="107.4" y1="125.5" x2="75.4" y2="125.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="75.4" y1="125.5" x2="73.5" y2="114.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="144.4" y1="159.5" x2="144.4" y2="135.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="144.4" y1="135.5" x2="144.4" y2="113.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="144.4" y1="113.5" x2="144.4" y2="108.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="144.4" y1="159.5" x2="144.4" y2="135.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="144.4" y1="135.5" x2="144.4" y2="113.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="144.4" y1="113.5" x2="144.4" y2="108.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'deutscher-hang': {
    media: {
      exercise_id: 'deutscher-hang',
      images: [
        {
          kind: 'start_position',
          file: 'deutscher-hang-start.svg',
          alt_de:
            'Ausgangsposition: an den Ringen hängen, Arme gestreckt, Knie zur Brust gezogen, bereit zum langsamen Durchdrehen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="113.1" y1="6" x2="110" y2="10.1" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="110" cy="10.1" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/><line x1="110.1" y1="98" x2="136.9" y2="77.1" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="136.9" y1="77.1" x2="133.5" y2="108.9" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="133.5" y1="108.9" x2="133.5" y2="119.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="108.2" y1="61.1" x2="109.4" y2="37.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="109.4" y1="37.1" x2="109.8" y2="15.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="109.8" y1="15.1" x2="110" y2="10.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="100.1,60.5 116.1,59.6 117.6,97.6 102.6,98.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="110.1" y1="98" x2="136.1" y2="76.1" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="136.1" y1="76.1" x2="133.3" y2="108" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="133.3" y1="108" x2="133.3" y2="119" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="110.1" y1="98" x2="136.1" y2="76.1" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="136.1" y1="76.1" x2="133.3" y2="108" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="133.3" y1="108" x2="133.3" y2="119" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108.2" y1="61.1" x2="109.8" y2="37.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="109.8" y1="37.1" x2="110.6" y2="15.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="110.6" y1="15.1" x2="110.8" y2="10.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108.2" y1="61.1" x2="109.8" y2="37.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="109.8" y1="37.1" x2="110.6" y2="15.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="110.6" y1="15.1" x2="110.8" y2="10.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="107.3" cy="44.1" r="10.6" fill="{gap}"/><circle cx="107.3" cy="44.1" r="9" fill="{figure}"/><line x1="114.1" y1="6" x2="110.8" y2="10.1" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="110.8" cy="10.1" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/></svg>',
    },
  },
  'diamant-liegestuetz': {
    media: {
      exercise_id: 'diamant-liegestuetz',
      images: [
        {
          kind: 'start_position',
          file: 'diamant-liegestuetz-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz, Hände eng unter der Brust (Daumen und Zeigefinger bilden eine Raute), Arme gestreckt, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="123.3" y1="133.2" x2="91.6" y2="145.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="91.6" y1="145.3" x2="61.5" y2="156.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="61.5" y1="156.3" x2="64.3" y2="166.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="159.3" y2="144.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="159.3" y1="144.5" x2="158.9" y2="166.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="158.9" y1="166.5" x2="163.9" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="156.3,112.6 161.8,127.7 125.9,140.2 120.7,126.1" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="174.2" cy="115.1" r="9" fill="{figure}"/><line x1="123.3" y1="133.2" x2="91.4" y2="144.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="91.4" y1="144.8" x2="61.3" y2="155.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="61.3" y1="155.7" x2="64.1" y2="166.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="123.3" y1="133.2" x2="91.4" y2="144.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="91.4" y1="144.8" x2="61.3" y2="155.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="61.3" y1="155.7" x2="64.1" y2="166.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="158.1" y2="144.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="158.1" y1="144.5" x2="158.1" y2="166.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="158.1" y1="166.5" x2="163.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="158.1" y2="144.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="158.1" y1="144.5" x2="158.1" y2="166.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="158.1" y1="166.5" x2="163.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'dips-barren': {
    media: {
      exercise_id: 'dips-barren',
      images: [
        {
          kind: 'start_position',
          file: 'dips-barren-start.svg',
          alt_de:
            'Ausgangsposition: Stütz am Barren mit gestreckten Armen, Schultern weg von den Ohren, Beine angewinkelt über dem Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="95.8" y1="170" x2="95.8" y2="84" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="147.8" y1="170" x2="147.8" y2="84" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="117.8" y1="74" x2="121.4" y2="107.8" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="121.4" y1="107.8" x2="92.4" y2="121.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="92.4" y1="121.3" x2="86.9" y2="130.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="116.6" y1="37" x2="118.3" y2="61" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="118.3" y1="61" x2="120.7" y2="82.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="120.7" y1="82.8" x2="120.7" y2="87.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="108.5,36.3 124.5,35.7 125.3,73.7 110.4,74.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="116" cy="20" r="9" fill="{figure}"/><line x1="117.8" y1="74" x2="123.8" y2="107.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="123.8" y1="107.5" x2="93.7" y2="118.4" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="93.7" y1="118.4" x2="88.2" y2="128" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.8" y1="74" x2="123.8" y2="107.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="123.8" y1="107.5" x2="93.7" y2="118.4" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="93.7" y1="118.4" x2="88.2" y2="128" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="116.6" y1="37" x2="118.8" y2="60.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="118.8" y1="60.9" x2="121.7" y2="82.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="121.7" y1="82.7" x2="121.7" y2="87.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="116.6" y1="37" x2="118.8" y2="60.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="118.8" y1="60.9" x2="121.7" y2="82.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="121.7" y1="82.7" x2="121.7" y2="87.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="89.8" y1="84" x2="153.8" y2="84" stroke="{equip}" stroke-width="4" stroke-linecap="round"/></svg>',
    },
  },
  'dips-negativ-barren': {
    media: {
      exercise_id: 'dips-negativ-barren',
      images: [
        {
          kind: 'start_position',
          file: 'dips-negativ-barren-start.svg',
          alt_de:
            'Ausgangsposition: oben im Stütz am Barren, Arme gestreckt, Schultern tief, Oberkörper leicht nach vorn, Beine angewinkelt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="95.8" y1="170" x2="95.8" y2="84" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="147.8" y1="170" x2="147.8" y2="84" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="117.8" y1="74" x2="121.4" y2="107.8" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="121.4" y1="107.8" x2="92.4" y2="121.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="92.4" y1="121.3" x2="86.9" y2="130.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="116.6" y1="37" x2="118.3" y2="61" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="118.3" y1="61" x2="120.7" y2="82.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="120.7" y1="82.8" x2="120.7" y2="87.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="108.5,36.3 124.5,35.7 125.3,73.7 110.4,74.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="116" cy="20" r="9" fill="{figure}"/><line x1="117.8" y1="74" x2="123.8" y2="107.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="123.8" y1="107.5" x2="93.7" y2="118.4" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="93.7" y1="118.4" x2="88.2" y2="128" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.8" y1="74" x2="123.8" y2="107.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="123.8" y1="107.5" x2="93.7" y2="118.4" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="93.7" y1="118.4" x2="88.2" y2="128" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="116.6" y1="37" x2="118.8" y2="60.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="118.8" y1="60.9" x2="121.7" y2="82.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="121.7" y1="82.7" x2="121.7" y2="87.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="116.6" y1="37" x2="118.8" y2="60.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="118.8" y1="60.9" x2="121.7" y2="82.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="121.7" y1="82.7" x2="121.7" y2="87.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="89.8" y1="84" x2="153.8" y2="84" stroke="{equip}" stroke-width="4" stroke-linecap="round"/></svg>',
    },
  },
  'dips-ringe': {
    media: {
      exercise_id: 'dips-ringe',
      images: [
        {
          kind: 'start_position',
          file: 'dips-ringe-start.svg',
          alt_de:
            'Ausgangsposition: ruhiger Stütz an den Ringen, Arme gestreckt, Ringe am Körper, Beine angewinkelt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="144.4" y1="6" x2="132.3" y2="87.7" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="132.3" cy="87.7" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/><line x1="142.4" y1="6" x2="131.3" y2="87.8" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="131.3" cy="87.8" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/><line x1="128.4" y1="74" x2="132" y2="107.8" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="132" y1="107.8" x2="103" y2="121.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="103" y1="121.3" x2="97.5" y2="130.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.2" y1="37" x2="128.9" y2="61" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="128.9" y1="61" x2="131.3" y2="82.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="131.3" y1="82.8" x2="131.3" y2="87.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="119.1,36.3 135.1,35.7 135.9,73.7 121,74.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="126.6" cy="20" r="9" fill="{figure}"/><line x1="128.4" y1="74" x2="134.4" y2="107.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="134.4" y1="107.5" x2="104.3" y2="118.4" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="104.3" y1="118.4" x2="98.8" y2="128" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.4" y1="74" x2="134.4" y2="107.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="134.4" y1="107.5" x2="104.3" y2="118.4" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="104.3" y1="118.4" x2="98.8" y2="128" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.2" y1="37" x2="129.4" y2="60.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="129.4" y1="60.9" x2="132.3" y2="82.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="132.3" y1="82.7" x2="132.3" y2="87.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="127.2" y1="37" x2="129.4" y2="60.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="129.4" y1="60.9" x2="132.3" y2="82.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="132.3" y1="82.7" x2="132.3" y2="87.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'dips-stuhl': {
    media: {
      exercise_id: 'dips-stuhl',
      images: [
        {
          kind: 'start_position',
          file: 'dips-stuhl-start.svg',
          alt_de:
            'Ausgangsposition: Hände auf der vorderen Sitzkante eines Stuhls an der Wand, Arme gestreckt, Gesäß vor dem Stuhl, Knie gebeugt, Füße am Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="69.1" y="20" width="6" height="150" fill="{furniture}"/><line x1="75.1" y1="170" x2="75.1" y2="105" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="105.1" y1="170" x2="105.1" y2="139" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="75.1" y1="139" x2="105.1" y2="139" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><line x1="113.1" y1="124" x2="144.9" y2="136.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="144.9" y1="136.2" x2="155.1" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="155.1" y1="166.5" x2="166.1" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="111.8" y1="87" x2="108.4" y2="110.8" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="108.4" y1="110.8" x2="106.2" y2="132.7" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="106.2" y1="132.7" x2="111.2" y2="132.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="103.8,86.3 119.8,85.7 120.6,123.7 105.6,124.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="111.2" cy="70" r="9" fill="{figure}"/><line x1="113.1" y1="124" x2="144.5" y2="137.1" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="144.5" y1="137.1" x2="157.1" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="157.1" y1="166.5" x2="168.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="113.1" y1="124" x2="144.5" y2="137.1" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="144.5" y1="137.1" x2="157.1" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="157.1" y1="166.5" x2="168.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="111.8" y1="87" x2="108.9" y2="110.8" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="108.9" y1="110.8" x2="107.1" y2="132.8" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="107.1" y1="132.8" x2="112.1" y2="132.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="111.8" y1="87" x2="108.9" y2="110.8" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="108.9" y1="110.8" x2="107.1" y2="132.8" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="107.1" y1="132.8" x2="112.1" y2="132.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'einarmiger-klimmzug-negativ': {
    media: {
      exercise_id: 'einarmiger-klimmzug-negativ',
      images: [
        {
          kind: 'start_position',
          file: 'einarmiger-klimmzug-negativ-start.svg',
          alt_de:
            'Ausgangsposition: oben an der Klimmzugstange, Kinn über der Stange; eine Hand an der Stange, die andere hält lose ein Handtuch, das über die Stange hängt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="121.8,6 121.8,6.5 135.8,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="126.8" y1="70" x2="119.7" y2="103.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="119.7" y1="103.3" x2="93.5" y2="121.6" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="93.5" y1="121.6" x2="91.6" y2="132.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="123.5" y1="33.1" x2="126.6" y2="56.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="126.6" y1="56.9" x2="142.8" y2="42" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="142.8" y1="42" x2="142.8" y2="37" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="115.5,32.8 131.4,31.4 134.2,69.3 119.3,70.7" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="122.8" cy="16.2" r="9" fill="{figure}"/><line x1="126.8" y1="70" x2="120.9" y2="103.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120.9" y1="103.5" x2="93.1" y2="119.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="93.1" y1="119.5" x2="91.2" y2="130.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126.8" y1="70" x2="120.9" y2="103.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120.9" y1="103.5" x2="93.1" y2="119.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="93.1" y1="119.5" x2="91.2" y2="130.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="123.5" y1="33.1" x2="147.5" y2="34.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="147.5" y1="34.2" x2="136.8" y2="15" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="136.8" y1="15" x2="136.8" y2="10" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="123.5" y1="33.1" x2="147.5" y2="34.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="147.5" y1="34.2" x2="136.8" y2="15" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="136.8" y1="15" x2="136.8" y2="10" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="135.8" cy="12.5" r="3.5" fill="{equip}"/><line x1="138.8" y1="14" x2="142.8" y2="37" stroke="{equipSoft}" stroke-width="3" stroke-linecap="round"/></svg>',
    },
  },
  'einbeinstand-laeufer': {
    media: {
      exercise_id: 'einbeinstand-laeufer',
      images: [
        {
          kind: 'start_position',
          file: 'einbeinstand-laeufer-start.svg',
          alt_de:
            'Ausgangsposition: auf einem Bein stehen, das andere Knie auf Hüfthöhe, Arme angewinkelt wie beim Laufen, Becken waagerecht.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="105.5" y1="99.5" x2="105.5" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="105.5" y1="133.5" x2="105.5" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="105.5" y1="165.5" x2="116.5" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="105.5" y1="62.5" x2="116.8" y2="83.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="116.8" y1="83.7" x2="137.7" y2="76.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="137.7" y1="76.9" x2="142.4" y2="75.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="97.5,61.5 113.5,61.5 113,99.5 98,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="105.5" cy="45.5" r="9" fill="{figure}"/><line x1="105.5" y1="99.5" x2="139.5" y2="99.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="139.5" y1="99.5" x2="136.7" y2="131.4" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="136.7" y1="131.4" x2="147" y2="135.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="105.5" y1="99.5" x2="139.5" y2="99.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="139.5" y1="99.5" x2="136.7" y2="131.4" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="136.7" y1="131.4" x2="147" y2="135.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="105.5" y1="62.5" x2="94.2" y2="83.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="94.2" y1="83.7" x2="108.9" y2="100" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="108.9" y1="100" x2="112.3" y2="103.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="105.5" y1="62.5" x2="94.2" y2="83.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="94.2" y1="83.7" x2="108.9" y2="100" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="108.9" y1="100" x2="112.3" y2="103.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'explosiver-klimmzug': {
    media: {
      exercise_id: 'explosiver-klimmzug',
      images: [
        {
          kind: 'start_position',
          file: 'explosiver-klimmzug-start.svg',
          alt_de:
            'Ausgangsposition: ruhiger, gestreckter Hang an der Klimmzugstange, Hände etwas weiter als schulterbreit, Füße über dem Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="123.7,6 123.7,6.5 137.7,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="128.5" y2="131.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="128.5" y1="131.7" x2="102.3" y2="150.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="102.3" y1="150.1" x2="100.4" y2="160.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132" y2="37.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="132" y1="37.1" x2="132.4" y2="15.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="132.4" y1="15.1" x2="132.6" y2="10.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122.7,60.5 138.7,59.6 140.2,97.6 125.2,98.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="129.8" cy="44.1" r="10.6" fill="{gap}"/><circle cx="129.8" cy="44.1" r="9" fill="{figure}"/><circle cx="137.7" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'face-pull-kabel': {
    media: {
      exercise_id: 'face-pull-kabel',
      images: [
        {
          kind: 'start_position',
          file: 'face-pull-kabel-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht vor dem Kabelzug stehen, Rolle auf Kopfhöhe, Seil mit beiden Händen und gestreckten Armen greifen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="154.9" y="20" width="12" height="150" rx="2" fill="{furniture}"/><circle cx="160.9" cy="48" r="4" fill="{furnitureLine}"/><line x1="84.9" y1="99.5" x2="83.1" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="83.1" y1="133.5" x2="83.7" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="83.7" y1="165.5" x2="94.7" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="83.6" y1="62.5" x2="107.3" y2="58.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="107.3" y1="58.4" x2="129" y2="54.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="129" y1="54.9" x2="133.9" y2="54.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="75.6,61.8 91.6,61.3 92.4,99.3 77.4,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="83" cy="45.6" r="9" fill="{figure}"/><line x1="84.9" y1="99.5" x2="86.1" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="86.1" y1="133.5" x2="85.5" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="85.5" y1="165.5" x2="96.5" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="84.9" y1="99.5" x2="86.1" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="86.1" y1="133.5" x2="85.5" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="85.5" y1="165.5" x2="96.5" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="83.6" y1="62.5" x2="107.1" y2="57.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="107.1" y1="57.6" x2="128.8" y2="53.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="128.8" y1="53.7" x2="133.7" y2="52.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="83.6" y1="62.5" x2="107.1" y2="57.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="107.1" y1="57.6" x2="128.8" y2="53.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="128.8" y1="53.7" x2="133.7" y2="52.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="160.9" y1="48" x2="128.8" y2="53.7" stroke="{equip}" stroke-width="1.8" stroke-linecap="round"/><circle cx="128.8" cy="53.7" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'fliegende-kabel': {
    media: {
      exercise_id: 'fliegende-kabel',
      images: [
        {
          kind: 'start_position',
          file: 'fliegende-kabel-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – zwischen zwei Kabelzügen stehen, Rollen auf Schulterhöhe, Arme leicht gebeugt seitlich geöffnet, Griffe in den Händen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="4" y="20" width="12" height="150" rx="2" fill="{furniture}"/><circle cx="10" cy="66" r="4" fill="{furnitureLine}"/><rect x="224" y="20" width="12" height="150" rx="2" fill="{furniture}"/><circle cx="230" cy="66" r="4" fill="{furnitureLine}"/><polygon points="108,61.5 132,61.5 128,99.5 112,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="45.5" r="9" fill="{figure}"/><line x1="114" y1="99.5" x2="115.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="115.2" y1="133.5" x2="115.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="115.2" y1="165.5" x2="110.5" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="99.5" x2="115.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="115.2" y1="133.5" x2="115.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="115.2" y1="165.5" x2="110.5" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.8" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="124.8" y1="133.5" x2="124.8" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="124.8" y1="165.5" x2="129.5" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.8" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="124.8" y1="133.5" x2="124.8" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="124.8" y1="165.5" x2="129.5" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="62.5" x2="84.2" y2="65.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="84.2" y1="65.9" x2="62.3" y2="64.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="62.3" y1="64.3" x2="57.3" y2="64" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="62.5" x2="84.2" y2="65.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="84.2" y1="65.9" x2="62.3" y2="64.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="62.3" y1="64.3" x2="57.3" y2="64" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="62.5" x2="155.8" y2="65.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="155.8" y1="65.9" x2="177.7" y2="64.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="177.7" y1="64.3" x2="182.7" y2="64" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="62.5" x2="155.8" y2="65.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="155.8" y1="65.9" x2="177.7" y2="64.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="177.7" y1="64.3" x2="182.7" y2="64" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="10" y1="66" x2="62.3" y2="64.3" stroke="{equip}" stroke-width="1.8" stroke-linecap="round"/><line x1="230" y1="66" x2="177.7" y2="64.3" stroke="{equip}" stroke-width="1.8" stroke-linecap="round"/><circle cx="62.3" cy="64.3" r="3.5" fill="{equip}"/><circle cx="177.7" cy="64.3" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'front-lever': {
    media: {
      exercise_id: 'front-lever',
      images: [
        {
          kind: 'start_position',
          file: 'front-lever-start.svg',
          alt_de:
            'Ausgangsposition: unter der Klimmzugstange, Arme gestreckt, Körper komplett gestreckt und waagerecht.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="158.4,6 158.4,6.5 172.4,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="128.4" y1="64" x2="94.4" y2="64.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="94.4" y1="64.6" x2="62.4" y2="64.6" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="62.4" y1="64.6" x2="51.4" y2="64.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="165.4" y1="64" x2="168.3" y2="40.2" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="168.3" y1="40.2" x2="171" y2="18.3" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="171" y1="18.3" x2="171.6" y2="13.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="166.4,56 166.4,72 128.4,71.5 128.4,56.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="128.4" y1="64" x2="94.4" y2="64" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="94.4" y1="64" x2="62.4" y2="64" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="62.4" y1="64" x2="51.4" y2="64" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.4" y1="64" x2="94.4" y2="64" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="94.4" y1="64" x2="62.4" y2="64" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="62.4" y1="64" x2="51.4" y2="64" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="165.4" y1="64" x2="168.7" y2="40.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="168.7" y1="40.2" x2="171.8" y2="18.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="171.8" y1="18.4" x2="172.5" y2="13.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="165.4" y1="64" x2="168.7" y2="40.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="168.7" y1="40.2" x2="171.8" y2="18.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="171.8" y1="18.4" x2="172.5" y2="13.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="182.4" cy="63.5" r="10.6" fill="{gap}"/><circle cx="182.4" cy="63.5" r="9" fill="{figure}"/><circle cx="172.4" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'front-lever-einbeinig': {
    media: {
      exercise_id: 'front-lever-einbeinig',
      images: [
        {
          kind: 'start_position',
          file: 'front-lever-einbeinig-start.svg',
          alt_de:
            'Ausgangsposition: unter der Klimmzugstange, Arme gestreckt, Körper waagerecht, ein Bein gestreckt, das andere zur Brust gezogen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="158.4,6 158.4,6.5 172.4,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="128.4" y1="64" x2="161.9" y2="69.9" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="161.9" y1="69.9" x2="129.9" y2="72.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="129.9" y1="72.1" x2="119" y2="73.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="165.4" y1="64" x2="168.3" y2="40.2" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="168.3" y1="40.2" x2="171" y2="18.3" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="171" y1="18.3" x2="171.6" y2="13.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="166.4,56 166.4,72 128.4,71.5 128.4,56.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="128.4" y1="64" x2="94.4" y2="64" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="94.4" y1="64" x2="62.4" y2="64" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="62.4" y1="64" x2="51.4" y2="64" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.4" y1="64" x2="94.4" y2="64" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="94.4" y1="64" x2="62.4" y2="64" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="62.4" y1="64" x2="51.4" y2="64" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="165.4" y1="64" x2="168.7" y2="40.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="168.7" y1="40.2" x2="171.8" y2="18.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="171.8" y1="18.4" x2="172.5" y2="13.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="165.4" y1="64" x2="168.7" y2="40.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="168.7" y1="40.2" x2="171.8" y2="18.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="171.8" y1="18.4" x2="172.5" y2="13.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="182.4" cy="63.5" r="10.6" fill="{gap}"/><circle cx="182.4" cy="63.5" r="9" fill="{figure}"/><circle cx="172.4" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'front-lever-gehockt': {
    media: {
      exercise_id: 'front-lever-gehockt',
      images: [
        {
          kind: 'start_position',
          file: 'front-lever-gehockt-start.svg',
          alt_de:
            'Ausgangsposition: unter der Klimmzugstange, Arme gestreckt, Rücken waagerecht, Knie eng zur Brust gezogen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="124.6,6 124.6,6.5 138.6,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="94.6" y1="64" x2="128.1" y2="69.9" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="128.1" y1="69.9" x2="96.1" y2="72.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="96.1" y1="72.1" x2="85.2" y2="73.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="131.6" y1="64" x2="134.5" y2="40.2" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="134.5" y1="40.2" x2="137.2" y2="18.3" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="137.2" y1="18.3" x2="137.8" y2="13.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="132.6,56 132.6,72 94.6,71.5 94.6,56.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="94.6" y1="64" x2="128.2" y2="68.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="128.2" y1="68.7" x2="96.4" y2="71.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="96.4" y1="71.5" x2="85.4" y2="72.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="94.6" y1="64" x2="128.2" y2="68.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="128.2" y1="68.7" x2="96.4" y2="71.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="96.4" y1="71.5" x2="85.4" y2="72.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="131.6" y1="64" x2="134.9" y2="40.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="134.9" y1="40.2" x2="138" y2="18.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="138" y1="18.4" x2="138.7" y2="13.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="131.6" y1="64" x2="134.9" y2="40.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="134.9" y1="40.2" x2="138" y2="18.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="138" y1="18.4" x2="138.7" y2="13.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="148.6" cy="63.5" r="10.6" fill="{gap}"/><circle cx="148.6" cy="63.5" r="9" fill="{figure}"/><circle cx="138.6" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'gesaess-dehnen-sitzend': {
    media: {
      exercise_id: 'gesaess-dehnen-sitzend',
      images: [
        {
          kind: 'start_position',
          file: 'gesaess-dehnen-sitzend-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht auf einem Stuhl sitzen, ein Knöchel liegt auf dem anderen Knie, Rücken gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="87.9" y1="170" x2="87.9" y2="103" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="115.9" y1="170" x2="115.9" y2="137" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="87.9" y1="137" x2="115.9" y2="137" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><line x1="109.9" y1="129" x2="143.4" y2="134.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="143.4" y1="134.6" x2="140.9" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="140.9" y1="166.5" x2="151.9" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="108.6" y1="92" x2="115.4" y2="115" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="115.4" y1="115" x2="122.5" y2="135.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="122.5" y1="135.8" x2="127.5" y2="135.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="100.6,91.3 116.5,90.7 117.4,128.7 102.4,129.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="108" cy="75" r="9" fill="{figure}"/><line x1="109.9" y1="129" x2="136.7" y2="108.1" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="136.7" y1="108.1" x2="133.9" y2="140" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="133.9" y1="140" x2="144.2" y2="143.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="109.9" y1="129" x2="136.7" y2="108.1" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="136.7" y1="108.1" x2="133.9" y2="140" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="133.9" y1="140" x2="144.2" y2="143.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108.6" y1="92" x2="116.3" y2="114.8" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="116.3" y1="114.8" x2="124.2" y2="135.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="124.2" y1="135.3" x2="129.2" y2="135.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108.6" y1="92" x2="116.3" y2="114.8" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="116.3" y1="114.8" x2="124.2" y2="135.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="124.2" y1="135.3" x2="129.2" y2="135.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'glute-bridge': {
    media: {
      exercise_id: 'glute-bridge',
      images: [
        {
          kind: 'start_position',
          file: 'glute-bridge-start.svg',
          alt_de:
            'Ausgangsposition: Rückenlage, Knie gebeugt, Füße hüftbreit nah am Gesäß, Arme seitlich am Körper abgelegt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="111.4" y1="160" x2="87.7" y2="135.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="87.7" y1="135.6" x2="79.4" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="79.4" y1="166.5" x2="68.4" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.4" y1="160" x2="124.4" y2="160.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="124.4" y1="160.4" x2="102.4" y2="160.4" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="102.4" y1="160.4" x2="97.4" y2="160.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="149.4,152 149.4,168 111.4,167.5 111.4,152.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="165.4" cy="159.5" r="9" fill="{figure}"/><line x1="111.4" y1="160" x2="88.1" y2="135.2" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="88.1" y1="135.2" x2="81.4" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="81.4" y1="166.5" x2="70.4" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="111.4" y1="160" x2="88.1" y2="135.2" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="88.1" y1="135.2" x2="81.4" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="81.4" y1="166.5" x2="70.4" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.4" y1="160" x2="124.4" y2="160.8" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="124.4" y1="160.8" x2="102.4" y2="160.8" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="102.4" y1="160.8" x2="97.4" y2="160.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="148.4" y1="160" x2="124.4" y2="160.8" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="124.4" y1="160.8" x2="102.4" y2="160.8" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="102.4" y1="160.8" x2="97.4" y2="160.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'glute-bridge-einbeinig': {
    media: {
      exercise_id: 'glute-bridge-einbeinig',
      images: [
        {
          kind: 'start_position',
          file: 'glute-bridge-einbeinig-start.svg',
          alt_de:
            'Ausgangsposition: Rückenlage, ein Fuß nah am Gesäß aufgestellt, das andere Bein gestreckt angehoben, Arme seitlich abgelegt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="118.7" y1="160" x2="95.1" y2="135.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="95.1" y1="135.6" x2="86.7" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="86.7" y1="166.5" x2="75.7" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="155.7" y1="160" x2="131.7" y2="160.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="131.7" y1="160.4" x2="109.7" y2="160.4" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="109.7" y1="160.4" x2="104.7" y2="160.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="156.7,152 156.7,168 118.7,167.5 118.7,152.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="172.7" cy="159.5" r="9" fill="{figure}"/><line x1="118.7" y1="160" x2="89.9" y2="142" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="89.9" y1="142" x2="62.8" y2="125" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="62.8" y1="125" x2="68.3" y2="115.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.7" y1="160" x2="89.9" y2="142" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="89.9" y1="142" x2="62.8" y2="125" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="62.8" y1="125" x2="68.3" y2="115.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="155.7" y1="160" x2="131.8" y2="160.8" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="131.8" y1="160.8" x2="109.8" y2="160.8" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="109.8" y1="160.8" x2="104.8" y2="160.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="155.7" y1="160" x2="131.8" y2="160.8" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="131.8" y1="160.8" x2="109.8" y2="160.8" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="109.8" y1="160.8" x2="104.8" y2="160.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'goblet-kniebeuge': {
    media: {
      exercise_id: 'goblet-kniebeuge',
      images: [
        {
          kind: 'start_position',
          file: 'goblet-kniebeuge-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, eine Kurzhantel senkrecht dicht vor der Brust halten, Ellbogen zeigen nach unten, Füße etwas weiter als hüftbreit.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="115.3" y1="99.5" x2="113.5" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="113.5" y1="133.5" x2="114.1" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="114.1" y1="165.5" x2="125.1" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="115.3" y1="62.5" x2="121.9" y2="85.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="121.9" y1="85.6" x2="125" y2="63.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="125" y1="63.8" x2="125" y2="58.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="107.3,61.5 123.3,61.5 122.8,99.5 107.8,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="115.3" cy="45.5" r="9" fill="{figure}"/><line x1="115.3" y1="99.5" x2="116.5" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="116.5" y1="133.5" x2="115.9" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="115.9" y1="165.5" x2="126.9" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="115.3" y1="99.5" x2="116.5" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="116.5" y1="133.5" x2="115.9" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="115.9" y1="165.5" x2="126.9" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="115.3" y1="62.5" x2="123.5" y2="85.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="123.5" y1="85.1" x2="125.4" y2="63.2" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="125.4" y1="63.2" x2="125.4" y2="58.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="115.3" y1="62.5" x2="123.5" y2="85.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="123.5" y1="85.1" x2="125.4" y2="63.2" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="125.4" y1="63.2" x2="125.4" y2="58.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.4" y1="62.2" x2="127.4" y2="76.2" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="121.9" y1="62.2" x2="132.9" y2="62.2" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="121.9" y1="76.2" x2="132.9" y2="76.2" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/></svg>',
    },
  },
  'good-morning-band': {
    media: {
      exercise_id: 'good-morning-band',
      images: [
        {
          kind: 'start_position',
          file: 'good-morning-band-start.svg',
          alt_de:
            'Ausgangsposition: hüftbreit auf dem Widerstandsband stehen, Schlaufe hinter dem Nacken auf den Schultern, Hände halten das Band vor der Brust, Knie leicht gebeugt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="117.1" y1="99.8" x2="121.2" y2="133.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="121.2" y1="133.6" x2="119" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="119" y1="165.5" x2="130" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="117.1" y1="62.8" x2="119.6" y2="86.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="119.6" y1="86.7" x2="127.1" y2="66" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="127.1" y1="66" x2="127.1" y2="61" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="109.1,61.8 125.1,61.8 124.6,99.8 109.6,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="117.1" cy="45.8" r="9" fill="{figure}"/><line x1="117.1" y1="99.8" x2="123" y2="133.3" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="123" y1="133.3" x2="119.7" y2="165.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="119.7" y1="165.1" x2="130.7" y2="165.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.1" y1="99.8" x2="123" y2="133.3" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="123" y1="133.3" x2="119.7" y2="165.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="119.7" y1="165.1" x2="130.7" y2="165.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="117.1" y1="62.8" x2="121.3" y2="86.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="121.3" y1="86.5" x2="127" y2="65.2" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="127" y1="65.2" x2="127" y2="60.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.1" y1="62.8" x2="121.3" y2="86.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="121.3" y1="86.5" x2="127" y2="65.2" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="127" y1="65.2" x2="127" y2="60.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><polyline points="125.7,167.1 127,65.2 111.1,63.8" fill="none" stroke="{equip}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    },
  },
  'good-morning-koerpergewicht': {
    media: {
      exercise_id: 'good-morning-koerpergewicht',
      images: [
        {
          kind: 'start_position',
          file: 'good-morning-koerpergewicht-start.svg',
          alt_de:
            'Ausgangsposition: hüftbreit stehen, Knie leicht gebeugt, Hände vor der Brust gekreuzt, Rücken gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="117.1" y1="99.8" x2="121.2" y2="133.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="121.2" y1="133.6" x2="119" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="119" y1="165.5" x2="130" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="117.1" y1="62.8" x2="119.6" y2="86.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="119.6" y1="86.7" x2="127.1" y2="66" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="127.1" y1="66" x2="127.1" y2="61" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="109.1,61.8 125.1,61.8 124.6,99.8 109.6,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="117.1" cy="45.8" r="9" fill="{figure}"/><line x1="117.1" y1="99.8" x2="123" y2="133.3" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="123" y1="133.3" x2="119.7" y2="165.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="119.7" y1="165.1" x2="130.7" y2="165.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.1" y1="99.8" x2="123" y2="133.3" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="123" y1="133.3" x2="119.7" y2="165.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="119.7" y1="165.1" x2="130.7" y2="165.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="117.1" y1="62.8" x2="121.3" y2="86.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="121.3" y1="86.5" x2="127" y2="65.2" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="127" y1="65.2" x2="127" y2="60.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.1" y1="62.8" x2="121.3" y2="86.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="121.3" y1="86.5" x2="127" y2="65.2" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="127" y1="65.2" x2="127" y2="60.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  hampelmann: {
    media: {
      exercise_id: 'hampelmann',
      images: [
        {
          kind: 'start_position',
          file: 'hampelmann-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – aufrecht stehen, Füße zusammen, Arme seitlich am Körper.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="108,61.5 132,61.5 128,99.5 112,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="45.5" r="9" fill="{figure}"/><line x1="114" y1="99.5" x2="115.8" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="115.8" y1="133.5" x2="115.8" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="115.8" y1="165.5" x2="111.1" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="99.5" x2="115.8" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="115.8" y1="133.5" x2="115.8" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="115.8" y1="165.5" x2="111.1" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="124.2" y1="133.5" x2="124.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="124.2" y1="165.5" x2="128.9" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="124.2" y1="133.5" x2="124.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="124.2" y1="165.5" x2="128.9" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="62.5" x2="105.5" y2="86.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="105.5" y1="86.4" x2="104.3" y2="108.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="104.3" y1="108.4" x2="104.1" y2="113.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="62.5" x2="105.5" y2="86.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="105.5" y1="86.4" x2="104.3" y2="108.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="104.3" y1="108.4" x2="104.1" y2="113.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="62.5" x2="134.5" y2="86.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="134.5" y1="86.4" x2="135.7" y2="108.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="135.7" y1="108.4" x2="135.9" y2="113.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="62.5" x2="134.5" y2="86.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="134.5" y1="86.4" x2="135.7" y2="108.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="135.7" y1="108.4" x2="135.9" y2="113.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'handstand-frei': {
    media: {
      exercise_id: 'handstand-frei',
      images: [
        {
          kind: 'start_position',
          file: 'handstand-frei-start.svg',
          alt_de:
            'Ausgangsposition: freier Handstand, Hände schulterbreit am Boden, Arme gestreckt, Körper vom Handgelenk bis zu den Zehen gerade übereinander.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="120" y1="83.5" x2="120.6" y2="49.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="120.6" y1="49.5" x2="120.6" y2="17.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="120.6" y1="17.5" x2="120.6" y2="6.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="120" y1="120.5" x2="119.6" y2="144.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="119.6" y1="144.5" x2="119.6" y2="166.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="119.6" y1="166.5" x2="124.6" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="128,121.5 112,121.5 112.5,83.5 127.5,83.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="120" y1="83.5" x2="120" y2="49.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120" y1="49.5" x2="120" y2="17.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="120" y1="17.5" x2="120" y2="6.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="120" y1="83.5" x2="120" y2="49.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120" y1="49.5" x2="120" y2="17.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="120" y1="17.5" x2="120" y2="6.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="120" y1="120.5" x2="120" y2="144.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="120" y1="144.5" x2="120" y2="166.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="120" y1="166.5" x2="125" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="120" y1="120.5" x2="120" y2="144.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="120" y1="144.5" x2="120" y2="166.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="120" y1="166.5" x2="125" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="120" cy="137.5" r="10.6" fill="{gap}"/><circle cx="120" cy="137.5" r="9" fill="{figure}"/></svg>',
    },
  },
  'handstand-wand': {
    media: {
      exercise_id: 'handstand-wand',
      images: [
        {
          kind: 'start_position',
          file: 'handstand-wand-start.svg',
          alt_de:
            'Ausgangsposition: Handstand mit dem Bauch zur Wand, Hände eine Handbreite vor der Wand, Arme gestreckt, Körper gerade, Zehen an der Wand.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="127.3" y="8" width="8" height="162" fill="{furniture}"/><line x1="115.3" y1="83.5" x2="115.3" y2="49.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="115.3" y1="49.5" x2="115.3" y2="17.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="115.3" y1="17.5" x2="117.2" y2="6.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="115.3" y1="120.5" x2="114.8" y2="144.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="114.8" y1="144.5" x2="114.8" y2="166.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="114.8" y1="166.5" x2="119.8" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="123.3,121.5 107.3,121.5 107.8,83.5 122.8,83.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="115.3" y1="83.5" x2="114.1" y2="49.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="114.1" y1="49.5" x2="112.9" y2="17.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="112.9" y1="17.5" x2="114.9" y2="6.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="115.3" y1="83.5" x2="114.1" y2="49.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="114.1" y1="49.5" x2="112.9" y2="17.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="112.9" y1="17.5" x2="114.9" y2="6.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="115.3" y1="120.5" x2="115.3" y2="144.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="115.3" y1="144.5" x2="115.3" y2="166.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="115.3" y1="166.5" x2="120.3" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="115.3" y1="120.5" x2="115.3" y2="144.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="115.3" y1="144.5" x2="115.3" y2="166.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="115.3" y1="166.5" x2="120.3" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="115.3" cy="137.5" r="10.6" fill="{gap}"/><circle cx="115.3" cy="137.5" r="9" fill="{figure}"/></svg>',
    },
  },
  'handtuch-latziehen': {
    media: {
      exercise_id: 'handtuch-latziehen',
      images: [
        {
          kind: 'start_position',
          file: 'handtuch-latziehen-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht knien, ein Handtuch an den Enden greifen, Hände deutlich weiter als schulterbreit, Arme schräg nach oben vor dem Kopf.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="118.9" y="167" width="26" height="3" rx="1.5" fill="{equipSoft}"/><line x1="130.9" y1="130.5" x2="129.7" y2="164.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="129.7" y1="164.5" x2="97.7" y2="164.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="97.7" y1="164.5" x2="86.7" y2="164.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.9" y1="93.5" x2="141.4" y2="71.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="141.4" y1="71.9" x2="149.6" y2="51.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="149.6" y1="51.5" x2="151.7" y2="47" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122.9,92.5 138.9,92.5 138.4,130.5 123.4,130.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="130.9" cy="76.5" r="9" fill="{figure}"/><line x1="130.9" y1="130.5" x2="130.9" y2="164.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="130.9" y1="164.5" x2="98.9" y2="164.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="98.9" y1="164.5" x2="87.9" y2="164.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.9" y1="130.5" x2="130.9" y2="164.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="130.9" y1="164.5" x2="98.9" y2="164.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="98.9" y1="164.5" x2="87.9" y2="164.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.9" y1="93.5" x2="142.1" y2="72.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="142.1" y1="72.3" x2="151.1" y2="52.2" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="151.1" y1="52.2" x2="153.1" y2="47.6" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.9" y1="93.5" x2="142.1" y2="72.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="142.1" y1="72.3" x2="151.1" y2="52.2" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="151.1" y1="52.2" x2="153.1" y2="47.6" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><rect x="146.1" y="46.2" width="10" height="12" rx="3" fill="{equipSoft}"/></svg>',
    },
  },
  'handtuch-rudern-isometrisch': {
    media: {
      exercise_id: 'handtuch-rudern-isometrisch',
      images: [
        {
          kind: 'start_position',
          file: 'handtuch-rudern-isometrisch-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht auf dem Boden sitzen, Beine leicht gebeugt, ein Handtuch um beide Fußsohlen, die Enden mit langen Armen greifen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="88.4" y1="162.5" x2="122" y2="157.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="122" y1="157.2" x2="152.9" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="152.9" y1="165.5" x2="154.8" y2="154.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="88.4" y1="125.5" x2="109.8" y2="136.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="109.8" y1="136.4" x2="131.2" y2="141.3" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="131.2" y1="141.3" x2="136.1" y2="142.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="80.4,124.5 96.4,124.5 95.9,162.5 80.9,162.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="88.4" cy="108.5" r="9" fill="{figure}"/><line x1="88.4" y1="162.5" x2="122.1" y2="157.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="122.1" y1="157.8" x2="153.1" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="153.1" y1="165.5" x2="155" y2="154.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="88.4" y1="162.5" x2="122.1" y2="157.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="122.1" y1="157.8" x2="153.1" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="153.1" y1="165.5" x2="155" y2="154.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="88.4" y1="125.5" x2="110.1" y2="135.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="110.1" y1="135.6" x2="131.7" y2="140.2" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="131.7" y1="140.2" x2="136.6" y2="141.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="88.4" y1="125.5" x2="110.1" y2="135.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="110.1" y1="135.6" x2="131.7" y2="140.2" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="131.7" y1="140.2" x2="136.6" y2="141.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><polyline points="131.7,140.2 160.1,161.5 159.1,169.5" fill="none" stroke="{equipSoft}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    },
  },
  'hechtstuetz-erhoeht': {
    media: {
      exercise_id: 'hechtstuetz-erhoeht',
      images: [
        {
          kind: 'start_position',
          file: 'hechtstuetz-erhoeht-start.svg',
          alt_de:
            'Ausgangsposition: Füße auf einem Stuhl, Hände schulterbreit am Boden, Hüfte hoch über den Schultern, Arme gestreckt, Kopf zwischen den Armen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="67.5" y1="170" x2="67.5" y2="76" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="97.5" y1="170" x2="97.5" y2="110" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="67.5" y1="110" x2="97.5" y2="110" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><line x1="151.5" y1="78" x2="121.2" y2="93.4" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="121.2" y1="93.4" x2="92.4" y2="107.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="92.4" y1="107.5" x2="94.3" y2="118.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="160.4" y1="113.9" x2="164.6" y2="137.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="164.6" y1="137.5" x2="167.3" y2="159.4" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="167.3" y1="159.4" x2="172.3" y2="159.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="168.4,112.9 152.9,116.8 144.2,79.8 158.8,76.2" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="162.6" cy="130.7" r="9" fill="{figure}"/><line x1="151.5" y1="78" x2="120.9" y2="92.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120.9" y1="92.9" x2="92.2" y2="106.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="92.2" y1="106.9" x2="94.1" y2="117.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="151.5" y1="78" x2="120.9" y2="92.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120.9" y1="92.9" x2="92.2" y2="106.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="92.2" y1="106.9" x2="94.1" y2="117.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="160.4" y1="113.9" x2="163.8" y2="137.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="163.8" y1="137.7" x2="166.8" y2="159.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="166.8" y1="159.5" x2="171.8" y2="159.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="160.4" y1="113.9" x2="163.8" y2="137.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="163.8" y1="137.7" x2="166.8" y2="159.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="166.8" y1="159.5" x2="171.8" y2="159.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'hip-thrust-langhantel': {
    media: {
      exercise_id: 'hip-thrust-langhantel',
      images: [
        {
          kind: 'start_position',
          file: 'hip-thrust-langhantel-start.svg',
          alt_de:
            'Ausgangsposition: mit dem Rücken vor einer Flachbank sitzen, Schulterblätter an der Bankkante, Langhantel über der Hüfte, Füße hüftbreit aufgestellt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="68.1" y="144" width="20" height="26" fill="{furniture}"/><rect x="64.1" y="138" width="28" height="7" rx="3" fill="{furnitureLine}"/><line x1="128.1" y1="156" x2="154.7" y2="134.8" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="154.7" y1="134.8" x2="159.1" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="159.1" y1="166.5" x2="170.1" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="95.5" y1="138.6" x2="116.7" y2="127.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="116.7" y1="127.5" x2="130.1" y2="145" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="130.1" y1="145" x2="135.1" y2="145" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="90.8,145.2 98.3,131.1 131.6,149.4 124.6,162.6" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="86.9" cy="124.5" r="9" fill="{figure}"/><line x1="128.1" y1="156" x2="155.1" y2="135.3" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="155.1" y1="135.3" x2="162.1" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="162.1" y1="166.5" x2="173.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.1" y1="156" x2="155.1" y2="135.3" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="155.1" y1="135.3" x2="162.1" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="162.1" y1="166.5" x2="173.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="95.5" y1="138.6" x2="117" y2="128.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="117" y1="128.1" x2="131.1" y2="145" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="131.1" y1="145" x2="136.1" y2="145" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="95.5" y1="138.6" x2="117" y2="128.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="117" y1="128.1" x2="131.1" y2="145" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="131.1" y1="145" x2="136.1" y2="145" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="131.1" cy="145" r="14" fill="none" stroke="{equip}" stroke-width="3.5"/><circle cx="131.1" cy="145" r="3" fill="{equip}"/></svg>',
    },
  },
  'hip-thrust-sofa': {
    media: {
      exercise_id: 'hip-thrust-sofa',
      images: [
        {
          kind: 'start_position',
          file: 'hip-thrust-sofa-start.svg',
          alt_de:
            'Ausgangsposition: mit dem Rücken vor einem Sofa sitzen, Schulterblätter an der Sitzkante, Knie gebeugt, Füße hüftbreit aufgestellt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="50.1" y="140" width="58" height="30" rx="4" fill="{furniture}"/><rect x="50.1" y="114" width="14" height="56" rx="5" fill="{furniture}"/><line x1="142.1" y1="156" x2="168.7" y2="134.8" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="168.7" y1="134.8" x2="173.1" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="173.1" y1="166.5" x2="184.1" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="109.5" y1="138.6" x2="133.1" y2="143" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="133.1" y1="143" x2="132.1" y2="165" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="132.1" y1="165" x2="137.1" y2="165" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="104.8,145.2 112.3,131.1 145.6,149.4 138.6,162.6" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="100.9" cy="124.5" r="9" fill="{figure}"/><line x1="142.1" y1="156" x2="169.1" y2="135.3" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="169.1" y1="135.3" x2="176.1" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="176.1" y1="166.5" x2="187.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="142.1" y1="156" x2="169.1" y2="135.3" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="169.1" y1="135.3" x2="176.1" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="176.1" y1="166.5" x2="187.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="109.5" y1="138.6" x2="133" y2="143" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="133" y1="143" x2="134.1" y2="165" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="134.1" y1="165" x2="139.1" y2="165" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="109.5" y1="138.6" x2="133" y2="143" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="133" y1="143" x2="134.1" y2="165" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="134.1" y1="165" x2="139.1" y2="165" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'hollow-body-gehockt': {
    media: {
      exercise_id: 'hollow-body-gehockt',
      images: [
        {
          kind: 'start_position',
          file: 'hollow-body-gehockt-start.svg',
          alt_de:
            'Ausgangsposition: Rückenlage, unterer Rücken am Boden, Schultern leicht angehoben, Knie zur Brust gezogen, Arme neben den Beinen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="106.9" y1="160.2" x2="117.4" y2="127.9" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="117.4" y1="127.9" x2="85.4" y2="125.7" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="85.4" y1="125.7" x2="75.1" y2="121.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="142.8" y1="151.3" x2="119.8" y2="144.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="119.8" y1="144.3" x2="98.8" y2="137.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="98.8" y1="137.8" x2="94" y2="136.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="141.8,143.3 145.7,158.8 108.7,167.5 105,152.9" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="158.6" cy="145.3" r="9" fill="{figure}"/><line x1="106.9" y1="160.2" x2="118.5" y2="128.3" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="118.5" y1="128.3" x2="86.6" y2="125.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="86.6" y1="125.5" x2="76.3" y2="121.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="106.9" y1="160.2" x2="118.5" y2="128.3" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="118.5" y1="128.3" x2="86.6" y2="125.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="86.6" y1="125.5" x2="76.3" y2="121.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="142.8" y1="151.3" x2="119.6" y2="145.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="119.6" y1="145.1" x2="98.3" y2="139.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="98.3" y1="139.4" x2="93.5" y2="138.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="142.8" y1="151.3" x2="119.6" y2="145.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="119.6" y1="145.1" x2="98.3" y2="139.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="98.3" y1="139.4" x2="93.5" y2="138.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'hollow-body-halten': {
    media: {
      exercise_id: 'hollow-body-halten',
      images: [
        {
          kind: 'start_position',
          file: 'hollow-body-halten-start.svg',
          alt_de:
            'Ausgangsposition: Rückenlage, Schultern und gestreckte Beine knapp über dem Boden, Arme gestreckt neben den Ohren, unterer Rücken am Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="115.3" y1="160.1" x2="81.6" y2="156" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="81.6" y1="156" x2="49.9" y2="151.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="49.9" y1="151.5" x2="39" y2="150" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="151.8" y1="153.7" x2="174.9" y2="147.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="174.9" y1="147.5" x2="196.2" y2="141.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="196.2" y1="141.8" x2="201" y2="140.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="151.3,145.6 154.1,161.4 116.6,167.5 114,152.7" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="168.2" cy="149.3" r="9" fill="{figure}"/><line x1="115.3" y1="160.1" x2="81.6" y2="155.4" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="81.6" y1="155.4" x2="50" y2="150.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="50" y1="150.9" x2="39.1" y2="149.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="115.3" y1="160.1" x2="81.6" y2="155.4" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="81.6" y1="155.4" x2="50" y2="150.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="50" y1="150.9" x2="39.1" y2="149.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="151.8" y1="153.7" x2="174.8" y2="147.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="174.8" y1="147.1" x2="196" y2="141" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="196" y1="141" x2="200.8" y2="139.6" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="151.8" y1="153.7" x2="174.8" y2="147.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="174.8" y1="147.1" x2="196" y2="141" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="196" y1="141" x2="200.8" y2="139.6" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'hueftkreisen-stehend': {
    media: {
      exercise_id: 'hueftkreisen-stehend',
      images: [
        {
          kind: 'start_position',
          file: 'hueftkreisen-stehend-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht neben einer Wand stehen, eine Hand an der Wand, das andere Knie auf Hüfthöhe angehoben.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="144.3" y="20" width="8" height="150" fill="{furniture}"/><line x1="98.3" y1="99.5" x2="132.3" y2="99.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="132.3" y1="99.5" x2="132.3" y2="131.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="132.3" y1="131.5" x2="143.3" y2="131.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.3" y1="62.5" x2="102.4" y2="86.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="102.4" y1="86.1" x2="103.2" y2="108.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="103.2" y1="108.1" x2="103.4" y2="113.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="90.3,61.5 106.3,61.5 105.8,99.5 90.8,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="98.3" cy="45.5" r="9" fill="{figure}"/><line x1="98.3" y1="99.5" x2="98.8" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="98.8" y1="133.5" x2="98.8" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="98.8" y1="165.5" x2="109.8" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.3" y1="99.5" x2="98.8" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="98.8" y1="133.5" x2="98.8" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="98.8" y1="165.5" x2="109.8" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.3" y1="62.5" x2="121.7" y2="67.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="121.7" y1="67.5" x2="143.7" y2="66.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="143.7" y1="66.7" x2="144.6" y2="61.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.3" y1="62.5" x2="121.7" y2="67.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="121.7" y1="67.5" x2="143.7" y2="66.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="143.7" y1="66.7" x2="144.6" y2="61.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'hueftstrecken-vierfuessler': {
    media: {
      exercise_id: 'hueftstrecken-vierfuessler',
      images: [
        {
          kind: 'start_position',
          file: 'hueftstrecken-vierfuessler-start.svg',
          alt_de:
            'Ausgangsposition: Vierfüßlerstand, Hände unter den Schultern, Knie unter der Hüfte, Rücken gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="113" y1="130.5" x2="111.8" y2="164.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="111.8" y1="164.5" x2="79.8" y2="164.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="79.8" y1="164.5" x2="68.8" y2="164.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.6" y1="120.3" x2="149.4" y2="144.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="149.4" y1="144.3" x2="148.7" y2="166.3" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="148.7" y1="166.3" x2="153.7" y2="166.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="147.3,112.3 151.7,127.7 115.1,137.7 110.9,123.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="164.9" cy="115.6" r="9" fill="{figure}"/><line x1="113" y1="130.5" x2="113" y2="164.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="113" y1="164.5" x2="81" y2="164.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="81" y1="164.5" x2="70" y2="164.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="113" y1="130.5" x2="113" y2="164.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="113" y1="164.5" x2="81" y2="164.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="81" y1="164.5" x2="70" y2="164.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.6" y1="120.3" x2="148.6" y2="144.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="148.6" y1="144.3" x2="148.6" y2="166.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="148.6" y1="166.3" x2="153.6" y2="166.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="148.6" y1="120.3" x2="148.6" y2="144.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="148.6" y1="144.3" x2="148.6" y2="166.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="148.6" y1="166.3" x2="153.6" y2="166.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  kabelrudern: {
    media: {
      exercise_id: 'kabelrudern',
      images: [
        {
          kind: 'start_position',
          file: 'kabelrudern-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht am Kabelzug sitzen, Füße an den Fußstützen, Knie leicht gebeugt, Griff mit gestreckten Armen fassen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="62.5" y1="166" x2="170.5" y2="166" stroke="{furnitureLine}" stroke-width="6" stroke-linecap="round"/><rect x="64.5" y="154" width="34" height="6" rx="3" fill="{furnitureLine}"/><line x1="142.5" y1="164" x2="148.5" y2="136" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><rect x="168.5" y="108" width="12" height="62" rx="2" fill="{furniture}"/><circle cx="174.5" cy="148" r="4" fill="{furnitureLine}"/><line x1="84.5" y1="148.5" x2="112.3" y2="128.9" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="112.3" y1="128.9" x2="134.5" y2="152" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="134.5" y1="152" x2="136.4" y2="141.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="84.5" y1="111.5" x2="103.6" y2="126" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="103.6" y1="126" x2="125.5" y2="124" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="125.5" y1="124" x2="130.4" y2="124.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="76.5,110.5 92.5,110.5 92,148.5 77,148.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="84.5" cy="94.5" r="9" fill="{figure}"/><line x1="84.5" y1="148.5" x2="113.1" y2="130.1" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="113.1" y1="130.1" x2="136.5" y2="152" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="136.5" y1="152" x2="138.4" y2="141.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="84.5" y1="148.5" x2="113.1" y2="130.1" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="113.1" y1="130.1" x2="136.5" y2="152" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="136.5" y1="152" x2="138.4" y2="141.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="84.5" y1="111.5" x2="104.5" y2="124.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="104.5" y1="124.7" x2="126.5" y2="124" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="126.5" y1="124" x2="131.4" y2="124.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="84.5" y1="111.5" x2="104.5" y2="124.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="104.5" y1="124.7" x2="126.5" y2="124" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="126.5" y1="124" x2="131.4" y2="124.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="174.5" y1="148" x2="126.5" y2="124" stroke="{equip}" stroke-width="1.8" stroke-linecap="round"/><circle cx="126.5" cy="124" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'katze-kuh': {
    media: {
      exercise_id: 'katze-kuh',
      images: [
        {
          kind: 'start_position',
          file: 'katze-kuh-start.svg',
          alt_de:
            'Ausgangsposition: Vierfüßlerstand, Hände unter den Schultern, Knie unter der Hüfte, Rücken gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="113" y1="130.5" x2="111.8" y2="164.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="111.8" y1="164.5" x2="79.8" y2="164.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="79.8" y1="164.5" x2="68.8" y2="164.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.6" y1="120.3" x2="149.4" y2="144.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="149.4" y1="144.3" x2="148.7" y2="166.3" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="148.7" y1="166.3" x2="153.7" y2="166.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="147.3,112.3 151.7,127.7 115.1,137.7 110.9,123.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="164.9" cy="115.6" r="9" fill="{figure}"/><line x1="113" y1="130.5" x2="113" y2="164.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="113" y1="164.5" x2="81" y2="164.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="81" y1="164.5" x2="70" y2="164.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="113" y1="130.5" x2="113" y2="164.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="113" y1="164.5" x2="81" y2="164.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="81" y1="164.5" x2="70" y2="164.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.6" y1="120.3" x2="148.6" y2="144.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="148.6" y1="144.3" x2="148.6" y2="166.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="148.6" y1="166.3" x2="153.6" y2="166.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="148.6" y1="120.3" x2="148.6" y2="144.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="148.6" y1="144.3" x2="148.6" y2="166.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="148.6" y1="166.3" x2="153.6" y2="166.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'kettlebell-swing': {
    media: {
      exercise_id: 'kettlebell-swing',
      images: [
        {
          kind: 'start_position',
          file: 'kettlebell-swing-start.svg',
          alt_de:
            'Ausgangsposition: Hüfte nach hinten geschoben, Rücken gerade, beide Hände greifen die Kettlebell, die etwa 30 cm vor den Füßen am Boden steht.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="96.6" y1="113" x2="120.4" y2="137.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="120.4" y1="137.2" x2="107.6" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="107.6" y1="166.5" x2="118.6" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="125.7" y1="90.2" x2="131.5" y2="113.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="131.5" y1="113.5" x2="137.7" y2="134.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="137.7" y1="134.6" x2="139.5" y2="139.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="121.6,83.3 131.4,95.9 101.2,118.9 91.9,107.1" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="140" cy="81" r="9" fill="{figure}"/><line x1="96.6" y1="113" x2="121.3" y2="136.3" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="121.3" y1="136.3" x2="110.6" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="110.6" y1="166.5" x2="121.6" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="96.6" y1="113" x2="121.3" y2="136.3" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="121.3" y1="136.3" x2="110.6" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="110.6" y1="166.5" x2="121.6" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="125.7" y1="90.2" x2="131.9" y2="113.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="131.9" y1="113.4" x2="138.5" y2="134.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="138.5" y1="134.4" x2="140.2" y2="139.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="125.7" y1="90.2" x2="131.9" y2="113.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="131.9" y1="113.4" x2="138.5" y2="134.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="138.5" y1="134.4" x2="140.2" y2="139.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="142.6" cy="152" r="5" fill="none" stroke="{equip}" stroke-width="3"/><circle cx="142.6" cy="162" r="8" fill="{equip}"/></svg>',
    },
  },
  klimmzug: {
    media: {
      exercise_id: 'klimmzug',
      images: [
        {
          kind: 'start_position',
          file: 'klimmzug-start.svg',
          alt_de:
            'Ausgangsposition: gestreckter Hang an der Klimmzugstange, Hände etwas weiter als schulterbreit, Beine angewinkelt, Füße über dem Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="123.7,6 123.7,6.5 137.7,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="128.5" y2="131.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="128.5" y1="131.7" x2="102.3" y2="150.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="102.3" y1="150.1" x2="100.4" y2="160.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132" y2="37.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="132" y1="37.1" x2="132.4" y2="15.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="132.4" y1="15.1" x2="132.6" y2="10.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122.7,60.5 138.7,59.6 140.2,97.6 125.2,98.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="129.8" cy="44.1" r="10.6" fill="{gap}"/><circle cx="129.8" cy="44.1" r="9" fill="{figure}"/><circle cx="137.7" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'klimmzug-band-unterstuetzt': {
    media: {
      exercise_id: 'klimmzug-band-unterstuetzt',
      images: [
        {
          kind: 'start_position',
          file: 'klimmzug-band-unterstuetzt-start.svg',
          alt_de:
            'Ausgangsposition: gestreckter Hang an der Klimmzugstange, ein Fuß steht in der Schlaufe eines Widerstandsbands, das an der Stange befestigt ist.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="119.9,6 119.9,6.5 133.9,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="128.9" y1="98" x2="124.8" y2="131.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="124.8" y1="131.7" x2="98.6" y2="150.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="98.6" y1="150.1" x2="96.7" y2="160.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="127" y1="61.1" x2="128.3" y2="37.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="128.3" y1="37.1" x2="128.6" y2="15.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="128.6" y1="15.1" x2="128.8" y2="10.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="119,60.5 134.9,59.6 136.4,97.6 121.5,98.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="128.9" y1="98" x2="140.6" y2="129.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="140.6" y1="129.9" x2="116.1" y2="150.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="116.1" y1="150.5" x2="121.6" y2="160" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.9" y1="98" x2="140.6" y2="129.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="140.6" y1="129.9" x2="116.1" y2="150.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="116.1" y1="150.5" x2="121.6" y2="160" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="127" y1="61.1" x2="128.7" y2="37.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="128.7" y1="37.1" x2="129.4" y2="15.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="129.4" y1="15.1" x2="129.6" y2="10.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="127" y1="61.1" x2="128.7" y2="37.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="128.7" y1="37.1" x2="129.4" y2="15.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="129.4" y1="15.1" x2="129.6" y2="10.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="126.1" cy="44.1" r="10.6" fill="{gap}"/><circle cx="126.1" cy="44.1" r="9" fill="{figure}"/><circle cx="133.9" cy="12.5" r="3.5" fill="{equip}"/><polyline points="131.9,14 112.1,155.5 122.6,165 134.9,14" fill="none" stroke="{equip}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    },
  },
  'klimmzug-negativ': {
    media: {
      exercise_id: 'klimmzug-negativ',
      images: [
        {
          kind: 'start_position',
          file: 'klimmzug-negativ-start.svg',
          alt_de:
            'Ausgangsposition: oben an der Klimmzugstange, Kinn über der Stange, Ellbogen gebeugt und nah am Körper, Beine angewinkelt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="121.8,6 121.8,6.5 135.8,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="126.8" y1="70" x2="119.7" y2="103.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="119.7" y1="103.3" x2="93.5" y2="121.6" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="93.5" y1="121.6" x2="91.6" y2="132.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="123.5" y1="33.1" x2="147.5" y2="33.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="147.5" y1="33.6" x2="135.8" y2="15" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="135.8" y1="15" x2="135.8" y2="10" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="115.5,32.8 131.4,31.4 134.2,69.3 119.3,70.7" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="122.8" cy="16.2" r="9" fill="{figure}"/><line x1="126.8" y1="70" x2="120.8" y2="103.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120.8" y1="103.5" x2="93.1" y2="119.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="93.1" y1="119.5" x2="91.2" y2="130.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126.8" y1="70" x2="120.8" y2="103.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120.8" y1="103.5" x2="93.1" y2="119.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="93.1" y1="119.5" x2="91.2" y2="130.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="123.5" y1="33.1" x2="147.5" y2="34.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="147.5" y1="34.2" x2="136.8" y2="15" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="136.8" y1="15" x2="136.8" y2="10" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="123.5" y1="33.1" x2="147.5" y2="34.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="147.5" y1="34.2" x2="136.8" y2="15" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="136.8" y1="15" x2="136.8" y2="10" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="135.8" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'kniebeuge-koerpergewicht': {
    media: {
      exercise_id: 'kniebeuge-koerpergewicht',
      images: [
        {
          kind: 'start_position',
          file: 'kniebeuge-koerpergewicht-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Füße etwa schulterbreit, Arme waagerecht nach vorn gestreckt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="98.4" y1="99.5" x2="96.6" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="96.6" y1="133.5" x2="97.2" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="97.2" y1="165.5" x2="108.2" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.3" y2="63.8" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="122.3" y1="63.8" x2="144.3" y2="64.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="144.3" y1="64.5" x2="149.3" y2="64.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="90.4,61.5 106.4,61.5 105.9,99.5 90.9,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="98.4" cy="45.5" r="9" fill="{figure}"/><line x1="98.4" y1="99.5" x2="99.6" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="99.6" y1="133.5" x2="99" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="99" y1="165.5" x2="110" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.4" y1="99.5" x2="99.6" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="99.6" y1="133.5" x2="99" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="99" y1="165.5" x2="110" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.4" y2="62.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="122.4" y1="62.5" x2="144.4" y2="62.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="144.4" y1="62.5" x2="149.4" y2="62.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.4" y2="62.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="122.4" y1="62.5" x2="144.4" y2="62.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="144.4" y1="62.5" x2="149.4" y2="62.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'kniebeuge-langhantel': {
    media: {
      exercise_id: 'kniebeuge-langhantel',
      images: [
        {
          kind: 'start_position',
          file: 'kniebeuge-langhantel-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Langhantel liegt auf dem oberen Rücken, Hände greifen die Stange, Füße schulterbreit; dahinter das Rack.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="93.6" y1="170" x2="93.6" y2="20" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><polyline points="87.6,70 99.6,70 99.6,65" fill="none" stroke="{furnitureLine}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><line x1="139.6" y1="99.5" x2="137.8" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="137.8" y1="133.5" x2="138.3" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="138.3" y1="165.5" x2="149.3" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="139.6" y1="62.5" x2="124.8" y2="81.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="124.8" y1="81.4" x2="132.3" y2="60.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="132.3" y1="60.8" x2="133.2" y2="55.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="131.6,61.5 147.6,61.5 147.1,99.5 132.1,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="139.6" cy="45.5" r="9" fill="{figure}"/><line x1="139.6" y1="99.5" x2="140.7" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="140.7" y1="133.5" x2="140.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="140.2" y1="165.5" x2="151.2" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="139.6" y1="99.5" x2="140.7" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="140.7" y1="133.5" x2="140.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="140.2" y1="165.5" x2="151.2" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="139.6" y1="62.5" x2="125.8" y2="82.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="125.8" y1="82.2" x2="132.6" y2="61.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="132.6" y1="61.3" x2="133.5" y2="56.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="139.6" y1="62.5" x2="125.8" y2="82.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="125.8" y1="82.2" x2="132.6" y2="61.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="132.6" y1="61.3" x2="133.5" y2="56.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="133.6" cy="64.5" r="14" fill="none" stroke="{equip}" stroke-width="3.5"/><circle cx="133.6" cy="64.5" r="3" fill="{equip}"/></svg>',
    },
  },
  'kniebeuge-pause': {
    media: {
      exercise_id: 'kniebeuge-pause',
      images: [
        {
          kind: 'start_position',
          file: 'kniebeuge-pause-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Füße etwa schulterbreit, Zehen leicht nach außen, Arme nach vorn gestreckt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="98.4" y1="99.5" x2="96.6" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="96.6" y1="133.5" x2="97.2" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="97.2" y1="165.5" x2="108.2" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.3" y2="63.8" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="122.3" y1="63.8" x2="144.3" y2="64.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="144.3" y1="64.5" x2="149.3" y2="64.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="90.4,61.5 106.4,61.5 105.9,99.5 90.9,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="98.4" cy="45.5" r="9" fill="{figure}"/><line x1="98.4" y1="99.5" x2="99.6" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="99.6" y1="133.5" x2="99" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="99" y1="165.5" x2="110" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.4" y1="99.5" x2="99.6" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="99.6" y1="133.5" x2="99" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="99" y1="165.5" x2="110" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.4" y2="62.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="122.4" y1="62.5" x2="144.4" y2="62.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="144.4" y1="62.5" x2="149.4" y2="62.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.4" y2="62.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="122.4" y1="62.5" x2="144.4" y2="62.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="144.4" y1="62.5" x2="149.4" y2="62.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'kniebeuge-stuhl': {
    media: {
      exercise_id: 'kniebeuge-stuhl',
      images: [
        {
          kind: 'start_position',
          file: 'kniebeuge-stuhl-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht vor einem Stuhl stehen, der Stuhl steht hinter dir, Füße schulterbreit, Arme nach vorn gestreckt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="73.4" y1="170" x2="73.4" y2="103" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="101.4" y1="170" x2="101.4" y2="137" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="73.4" y1="137" x2="101.4" y2="137" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><line x1="115.4" y1="99.5" x2="113.6" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="113.6" y1="133.5" x2="114.2" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="114.2" y1="165.5" x2="125.2" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="115.4" y1="62.5" x2="139.3" y2="63.8" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="139.3" y1="63.8" x2="161.3" y2="64.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="161.3" y1="64.5" x2="166.3" y2="64.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="107.4,61.5 123.4,61.5 122.9,99.5 107.9,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="115.4" cy="45.5" r="9" fill="{figure}"/><line x1="115.4" y1="99.5" x2="116.6" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="116.6" y1="133.5" x2="116" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="116" y1="165.5" x2="127" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="115.4" y1="99.5" x2="116.6" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="116.6" y1="133.5" x2="116" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="116" y1="165.5" x2="127" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="115.4" y1="62.5" x2="139.4" y2="62.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="139.4" y1="62.5" x2="161.4" y2="62.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="161.4" y1="62.5" x2="166.4" y2="62.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="115.4" y1="62.5" x2="139.4" y2="62.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="139.4" y1="62.5" x2="161.4" y2="62.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="161.4" y1="62.5" x2="166.4" y2="62.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'kniebeuge-tempo': {
    media: {
      exercise_id: 'kniebeuge-tempo',
      images: [
        {
          kind: 'start_position',
          file: 'kniebeuge-tempo-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Füße etwa schulterbreit, Zehen leicht nach außen, Arme nach vorn gestreckt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="98.4" y1="99.5" x2="96.6" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="96.6" y1="133.5" x2="97.2" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="97.2" y1="165.5" x2="108.2" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.3" y2="63.8" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="122.3" y1="63.8" x2="144.3" y2="64.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="144.3" y1="64.5" x2="149.3" y2="64.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="90.4,61.5 106.4,61.5 105.9,99.5 90.9,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="98.4" cy="45.5" r="9" fill="{figure}"/><line x1="98.4" y1="99.5" x2="99.6" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="99.6" y1="133.5" x2="99" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="99" y1="165.5" x2="110" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.4" y1="99.5" x2="99.6" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="99.6" y1="133.5" x2="99" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="99" y1="165.5" x2="110" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.4" y2="62.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="122.4" y1="62.5" x2="144.4" y2="62.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="144.4" y1="62.5" x2="149.4" y2="62.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.4" y2="62.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="122.4" y1="62.5" x2="144.4" y2="62.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="144.4" y1="62.5" x2="149.4" y2="62.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'knieheben-haengend': {
    media: {
      exercise_id: 'knieheben-haengend',
      images: [
        {
          kind: 'start_position',
          file: 'knieheben-haengend-start.svg',
          alt_de:
            'Ausgangsposition: ruhiger, gestreckter Hang an der Klimmzugstange, Beine hängen locker nach unten, Füße über dem Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="123.7,6 123.7,6.5 137.7,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="128.5" y2="131.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="128.5" y1="131.7" x2="102.3" y2="150.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="102.3" y1="150.1" x2="100.4" y2="160.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132" y2="37.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="132" y1="37.1" x2="132.4" y2="15.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="132.4" y1="15.1" x2="132.6" y2="10.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122.7,60.5 138.7,59.6 140.2,97.6 125.2,98.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="129.8" cy="44.1" r="10.6" fill="{gap}"/><circle cx="129.8" cy="44.1" r="9" fill="{figure}"/><circle cx="137.7" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'kurzhantelrudern-einarmig': {
    media: {
      exercise_id: 'kurzhantelrudern-einarmig',
      images: [
        {
          kind: 'start_position',
          file: 'kurzhantelrudern-einarmig-start.svg',
          alt_de:
            'Ausgangsposition: eine Hand und ein Knie auf der Flachbank, der andere Fuß am Boden, Rücken gerade, Kurzhantel hängt am gestreckten Arm unter der Schulter.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="70.4" y="144" width="4" height="26" fill="{furnitureLine}"/><rect x="156.4" y="144" width="4" height="26" fill="{furnitureLine}"/><rect x="64.4" y="138" width="102" height="7" rx="3" fill="{furnitureLine}"/><line x1="114.4" y1="99.5" x2="112.4" y2="133.4" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="112.4" y1="133.4" x2="80.4" y2="133.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="80.4" y1="133.5" x2="69.4" y2="133.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="149.9" y1="89.3" x2="142.8" y2="112.2" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="142.8" y1="112.2" x2="151.4" y2="132.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="151.4" y1="132.5" x2="156.4" y2="132.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="148.7,81.3 153.1,96.7 116.4,106.7 112.3,92.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="166.6" cy="86" r="9" fill="{figure}"/><line x1="114.4" y1="99.5" x2="119" y2="133.2" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="119" y1="133.2" x2="122.2" y2="165" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="122.2" y1="165" x2="133.2" y2="165" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114.4" y1="99.5" x2="119" y2="133.2" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="119" y1="133.2" x2="122.2" y2="165" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="122.2" y1="165" x2="133.2" y2="165" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="149.9" y1="89.3" x2="149.9" y2="113.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="149.9" y1="113.3" x2="149.9" y2="135.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="149.9" y1="135.3" x2="149.9" y2="140.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="149.9" y1="89.3" x2="149.9" y2="113.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="149.9" y1="113.3" x2="149.9" y2="135.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="149.9" y1="135.3" x2="149.9" y2="140.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="156.9" y1="137.3" x2="142.9" y2="137.3" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="156.9" y1="131.8" x2="156.9" y2="142.8" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="142.9" y1="131.8" x2="142.9" y2="142.8" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/></svg>',
    },
  },
  'l-sitz': {
    media: {
      exercise_id: 'l-sitz',
      images: [
        {
          kind: 'start_position',
          file: 'l-sitz-start.svg',
          alt_de:
            'Ausgangsposition: Stütz auf Parallettes, Arme gestreckt, Beine gestreckt und etwa waagerecht nach vorn – der Körper bildet ein „L“.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="79.1,170 82.1,158 94.1,158 97.1,170" fill="none" stroke="{equip}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><line x1="86.1" y1="143" x2="120.1" y2="142.4" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="120.1" y1="142.4" x2="152.1" y2="141.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="152.1" y1="141.3" x2="162.9" y2="139.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="84.8" y1="106" x2="85.4" y2="130" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="85.4" y1="130" x2="86.9" y2="152" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="86.9" y1="152" x2="91.9" y2="152" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="76.8,105.3 92.8,104.7 93.6,142.7 78.6,143.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="84.2" cy="89" r="9" fill="{figure}"/><line x1="86.1" y1="143" x2="120.1" y2="141.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120.1" y1="141.8" x2="152.1" y2="140.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="152.1" y1="140.7" x2="162.9" y2="138.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="86.1" y1="143" x2="120.1" y2="141.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120.1" y1="141.8" x2="152.1" y2="140.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="152.1" y1="140.7" x2="162.9" y2="138.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="84.8" y1="106" x2="85.9" y2="130" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="85.9" y1="130" x2="87.8" y2="151.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="87.8" y1="151.9" x2="92.8" y2="151.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="84.8" y1="106" x2="85.9" y2="130" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="85.9" y1="130" x2="87.8" y2="151.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="87.8" y1="151.9" x2="92.8" y2="151.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'l-sitz-gehockt': {
    media: {
      exercise_id: 'l-sitz-gehockt',
      images: [
        {
          kind: 'start_position',
          file: 'l-sitz-gehockt-start.svg',
          alt_de:
            'Ausgangsposition: Stütz am Boden, Hände neben der Hüfte, Arme gestreckt, Gesäß und Füße angehoben, Knie zur Brust gezogen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="101.9" y1="160" x2="121.8" y2="132.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="121.8" y1="132.5" x2="136.4" y2="161" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="136.4" y1="161" x2="147.2" y2="162.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="100.6" y1="123" x2="101.3" y2="147" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="101.3" y1="147" x2="102.8" y2="169" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="102.8" y1="169" x2="107.8" y2="169" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="92.5,122.3 108.5,121.7 109.4,159.7 94.4,160.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="100" cy="106" r="9" fill="{figure}"/><line x1="101.9" y1="160" x2="120.9" y2="131.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120.9" y1="131.8" x2="135.9" y2="160.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="135.9" y1="160.1" x2="146.7" y2="162" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="101.9" y1="160" x2="120.9" y2="131.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120.9" y1="131.8" x2="135.9" y2="160.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="135.9" y1="160.1" x2="146.7" y2="162" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="100.6" y1="123" x2="101.8" y2="147" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="101.8" y1="147" x2="103.8" y2="168.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="103.8" y1="168.9" x2="108.8" y2="168.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="100.6" y1="123" x2="101.8" y2="147" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="101.8" y1="147" x2="103.8" y2="168.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="103.8" y1="168.9" x2="108.8" y2="168.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'laeufer-kniehub-stand': {
    media: {
      exercise_id: 'laeufer-kniehub-stand',
      images: [
        {
          kind: 'start_position',
          file: 'laeufer-kniehub-stand-start.svg',
          alt_de:
            'Ausgangsposition: auf einem Bein stehen, das andere Knie leicht angehoben, Arme angewinkelt wie beim Laufen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="106.5" y1="99.5" x2="106.5" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="106.5" y1="133.5" x2="106.5" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="106.5" y1="165.5" x2="117.5" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="106.5" y1="62.5" x2="117.8" y2="83.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="117.8" y1="83.7" x2="138.7" y2="76.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="138.7" y1="76.9" x2="143.5" y2="75.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="98.5,61.5 114.5,61.5 114,99.5 99,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="106.5" cy="45.5" r="9" fill="{figure}"/><line x1="106.5" y1="99.5" x2="138.5" y2="111.1" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="138.5" y1="111.1" x2="135.7" y2="143" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="135.7" y1="143" x2="146" y2="146.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="106.5" y1="99.5" x2="138.5" y2="111.1" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="138.5" y1="111.1" x2="135.7" y2="143" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="135.7" y1="143" x2="146" y2="146.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="106.5" y1="62.5" x2="95.2" y2="83.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="95.2" y1="83.7" x2="110" y2="100" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="110" y1="100" x2="113.3" y2="103.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="106.5" y1="62.5" x2="95.2" y2="83.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="95.2" y1="83.7" x2="110" y2="100" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="110" y1="100" x2="113.3" y2="103.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  langhantelrudern: {
    media: {
      exercise_id: 'langhantelrudern',
      images: [
        {
          kind: 'start_position',
          file: 'langhantelrudern-start.svg',
          alt_de:
            'Ausgangsposition: Oberkörper etwa 45 Grad vorgebeugt, Rücken gerade, Knie leicht gebeugt, Langhantel hängt an gestreckten Armen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="100.8" y1="101.5" x2="111.8" y2="133.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="111.8" y1="133.7" x2="108.5" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="108.5" y1="165.5" x2="119.5" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="126.9" y1="75.4" x2="126.1" y2="99.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="126.1" y1="99.4" x2="125.7" y2="121.3" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="125.7" y1="121.3" x2="125.7" y2="126.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122,69 133.3,80.3 106.1,106.8 95.5,96.2" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="138" cy="62.5" r="9" fill="{figure}"/><line x1="100.8" y1="101.5" x2="113.5" y2="133.1" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="113.5" y1="133.1" x2="109" y2="164.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="109" y1="164.7" x2="120" y2="164.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="100.8" y1="101.5" x2="113.5" y2="133.1" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="113.5" y1="133.1" x2="109" y2="164.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="109" y1="164.7" x2="120" y2="164.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126.9" y1="75.4" x2="126.9" y2="99.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="126.9" y1="99.4" x2="126.9" y2="121.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="126.9" y1="121.4" x2="126.9" y2="126.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126.9" y1="75.4" x2="126.9" y2="99.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="126.9" y1="99.4" x2="126.9" y2="121.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="126.9" y1="121.4" x2="126.9" y2="126.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="126.9" cy="123.4" r="14" fill="none" stroke="{equip}" stroke-width="3.5"/><circle cx="126.9" cy="123.4" r="3" fill="{equip}"/></svg>',
    },
  },
  'lat-dehnung-stehend': {
    media: {
      exercise_id: 'lat-dehnung-stehend',
      images: [
        {
          kind: 'start_position',
          file: 'lat-dehnung-stehend-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – aufrecht stehen, ein Arm gestreckt über dem Kopf, die andere Hand an der Hüfte.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="103.8,61.5 127.8,61.5 123.8,99.5 107.8,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="115.8" cy="45.5" r="9" fill="{figure}"/><line x1="109.8" y1="99.5" x2="110.9" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="110.9" y1="133.5" x2="110.9" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="110.9" y1="165.5" x2="106.3" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="109.8" y1="99.5" x2="110.9" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="110.9" y1="133.5" x2="110.9" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="110.9" y1="165.5" x2="106.3" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="121.8" y1="99.5" x2="120.6" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120.6" y1="133.5" x2="120.6" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="120.6" y1="165.5" x2="125.2" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="121.8" y1="99.5" x2="120.6" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120.6" y1="133.5" x2="120.6" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="120.6" y1="165.5" x2="125.2" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="103.8" y1="62.5" x2="101.7" y2="38.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="101.7" y1="38.6" x2="99.7" y2="16.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="99.7" y1="16.7" x2="99.3" y2="11.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="103.8" y1="62.5" x2="101.7" y2="38.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="101.7" y1="38.6" x2="99.7" y2="16.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="99.7" y1="16.7" x2="99.3" y2="11.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.8" y1="62.5" x2="139.8" y2="83.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="139.8" y1="83.3" x2="135.9" y2="105" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="135.9" y1="105" x2="135.1" y2="109.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="127.8" y1="62.5" x2="139.8" y2="83.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="139.8" y1="83.3" x2="135.9" y2="105" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="135.9" y1="105" x2="135.1" y2="109.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  latziehen: {
    media: {
      exercise_id: 'latziehen',
      images: [
        {
          kind: 'start_position',
          file: 'latziehen-start.svg',
          alt_de:
            'Ausgangsposition: am Latzug sitzen, Oberschenkel unter dem Polster, Stange mit gestreckten Armen über dem Kopf, Oberkörper leicht nach hinten geneigt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="75.1" y="8" width="12" height="162" rx="2" fill="{furniture}"/><line x1="81.1" y1="8" x2="125.1" y2="8" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><rect x="105.1" y="134" width="34" height="6" rx="3" fill="{furnitureLine}"/><rect x="115.1" y="140" width="14" height="30" fill="{furniture}"/><line x1="121.5" y1="42.4" x2="123.1" y2="10" stroke="{equip}" stroke-width="1.8" stroke-linecap="round"/><line x1="119.1" y1="126" x2="152" y2="134.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="152" y1="134.6" x2="149.1" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="149.1" y1="166.5" x2="160.1" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="112.7" y1="89.6" x2="116.9" y2="65.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="116.9" y1="65.9" x2="120.3" y2="44.2" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="120.3" y1="44.2" x2="121.2" y2="39.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="104.6,90 120.4,87.2 126.5,124.7 111.7,127.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="110.2" cy="72.7" r="9" fill="{figure}"/><line x1="119.1" y1="126" x2="152" y2="134.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="152" y1="134.5" x2="151.1" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="151.1" y1="166.5" x2="162.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="119.1" y1="126" x2="152" y2="134.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="152" y1="134.5" x2="151.1" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="151.1" y1="166.5" x2="162.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="112.7" y1="89.6" x2="117.7" y2="66.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="117.7" y1="66.1" x2="121.5" y2="44.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="121.5" y1="44.4" x2="122.4" y2="39.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="112.7" y1="89.6" x2="117.7" y2="66.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="117.7" y1="66.1" x2="121.5" y2="44.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="121.5" y1="44.4" x2="122.4" y2="39.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="141.1" cy="114" r="6" fill="{furnitureLine}"/><circle cx="121.5" cy="42.4" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'latziehen-band': {
    media: {
      exercise_id: 'latziehen-band',
      images: [
        {
          kind: 'start_position',
          file: 'latziehen-band-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht knien, die Enden des oben befestigten Widerstandsbands mit gestreckten Armen über dem Kopf greifen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="162.5" y="20" width="8" height="150" fill="{furniture}"/><line x1="116.5" y1="130.5" x2="115.3" y2="164.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="115.3" y1="164.5" x2="83.3" y2="164.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="83.3" y1="164.5" x2="72.3" y2="164.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="116.5" y1="93.5" x2="123.9" y2="70.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="123.9" y1="70.7" x2="130.3" y2="49.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="130.3" y1="49.6" x2="131.9" y2="44.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="108.5,92.5 124.5,92.5 124,130.5 109,130.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="116.5" cy="76.5" r="9" fill="{figure}"/><line x1="116.5" y1="130.5" x2="116.5" y2="164.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="116.5" y1="164.5" x2="84.5" y2="164.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="84.5" y1="164.5" x2="73.5" y2="164.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="116.5" y1="130.5" x2="116.5" y2="164.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="116.5" y1="164.5" x2="84.5" y2="164.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="84.5" y1="164.5" x2="73.5" y2="164.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="116.5" y1="93.5" x2="124.7" y2="70.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="124.7" y1="70.9" x2="131.5" y2="50" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="131.5" y1="50" x2="133" y2="45.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="116.5" y1="93.5" x2="124.7" y2="70.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="124.7" y1="70.9" x2="131.5" y2="50" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="131.5" y1="50" x2="133" y2="45.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="131.5" y1="50" x2="162.5" y2="30" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
  },
  'lauf-abc-anfersen': {
    media: {
      exercise_id: 'lauf-abc-anfersen',
      images: [
        {
          kind: 'start_position',
          file: 'lauf-abc-anfersen-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht auf einem Bein, die andere Ferse ist zum Gesäß geführt, Arme angewinkelt wie beim Laufen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="117.1" y1="99.5" x2="117.1" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="117.1" y1="133.5" x2="117.1" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="117.1" y1="165.5" x2="128.1" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="115.8" y1="62.5" x2="127" y2="83.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="127" y1="83.7" x2="148" y2="76.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="148" y1="76.9" x2="152.7" y2="75.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="107.7,61.8 123.7,61.2 124.6,99.2 109.6,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="115.2" cy="45.5" r="9" fill="{figure}"/><line x1="117.1" y1="99.5" x2="111.2" y2="133" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="111.2" y1="133" x2="97.6" y2="104" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="97.6" y1="104" x2="87.3" y2="100.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.1" y1="99.5" x2="111.2" y2="133" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="111.2" y1="133" x2="97.6" y2="104" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="97.6" y1="104" x2="87.3" y2="100.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="115.8" y1="62.5" x2="104.5" y2="83.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="104.5" y1="83.7" x2="119.2" y2="100.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="119.2" y1="100.1" x2="122.6" y2="103.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="115.8" y1="62.5" x2="104.5" y2="83.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="104.5" y1="83.7" x2="119.2" y2="100.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="119.2" y1="100.1" x2="122.6" y2="103.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'lauf-abc-fussgelenksarbeit': {
    media: {
      exercise_id: 'lauf-abc-fussgelenksarbeit',
      images: [
        {
          kind: 'start_position',
          file: 'lauf-abc-fussgelenksarbeit-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Arme angewinkelt wie beim Laufen, eine Ferse leicht angehoben, der Ballen bleibt am Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="109.1" y1="94.4" x2="109.7" y2="128.4" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="109.7" y1="128.4" x2="110.8" y2="160.4" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="110.8" y1="160.4" x2="121.8" y2="160.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="107.8" y1="57.4" x2="96.5" y2="78.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="96.5" y1="78.6" x2="111.2" y2="94.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="111.2" y1="94.9" x2="114.6" y2="98.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="99.8,56.7 115.7,56.1 116.6,94.1 101.6,94.6" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="107.2" cy="40.4" r="9" fill="{figure}"/><line x1="109.1" y1="94.4" x2="107.9" y2="128.4" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="107.9" y1="128.4" x2="104.5" y2="160.2" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="104.5" y1="160.2" x2="113" y2="167.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="109.1" y1="94.4" x2="107.9" y2="128.4" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="107.9" y1="128.4" x2="104.5" y2="160.2" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="104.5" y1="160.2" x2="113" y2="167.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="107.8" y1="57.4" x2="119.1" y2="78.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="119.1" y1="78.6" x2="140" y2="71.8" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="140" y1="71.8" x2="144.7" y2="70.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="107.8" y1="57.4" x2="119.1" y2="78.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="119.1" y1="78.6" x2="140" y2="71.8" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="140" y1="71.8" x2="144.7" y2="70.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'lauf-abc-hopserlauf': {
    media: {
      exercise_id: 'lauf-abc-hopserlauf',
      images: [
        {
          kind: 'start_position',
          file: 'lauf-abc-hopserlauf-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht auf dem Vorfuß eines Beins, das andere Knie vorn oben, Arme angewinkelt gegengleich.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="105.7" y1="99.5" x2="105.7" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="105.7" y1="133.5" x2="105.7" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="105.7" y1="165.5" x2="116.7" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="105.7" y1="62.5" x2="117" y2="83.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="117" y1="83.7" x2="137.9" y2="76.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="137.9" y1="76.9" x2="142.7" y2="75.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="97.7,61.5 113.7,61.5 113.2,99.5 98.2,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="105.7" cy="45.5" r="9" fill="{figure}"/><line x1="105.7" y1="99.5" x2="139.2" y2="105.4" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="139.2" y1="105.4" x2="136.4" y2="137.3" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="136.4" y1="137.3" x2="146.8" y2="141" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="105.7" y1="99.5" x2="139.2" y2="105.4" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="139.2" y1="105.4" x2="136.4" y2="137.3" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="136.4" y1="137.3" x2="146.8" y2="141" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="105.7" y1="62.5" x2="94.5" y2="83.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="94.5" y1="83.7" x2="109.2" y2="100" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="109.2" y1="100" x2="112.5" y2="103.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="105.7" y1="62.5" x2="94.5" y2="83.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="94.5" y1="83.7" x2="109.2" y2="100" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="109.2" y1="100" x2="112.5" y2="103.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'lauf-abc-kniehebelauf': {
    media: {
      exercise_id: 'lauf-abc-kniehebelauf',
      images: [
        {
          kind: 'start_position',
          file: 'lauf-abc-kniehebelauf-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht auf einem Bein, das andere Knie auf Hüfthöhe, Arme angewinkelt gegengleich wie beim Laufen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="105.5" y1="99.5" x2="105.5" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="105.5" y1="133.5" x2="105.5" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="105.5" y1="165.5" x2="116.5" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="105.5" y1="62.5" x2="116.8" y2="83.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="116.8" y1="83.7" x2="137.7" y2="76.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="137.7" y1="76.9" x2="142.4" y2="75.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="97.5,61.5 113.5,61.5 113,99.5 98,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="105.5" cy="45.5" r="9" fill="{figure}"/><line x1="105.5" y1="99.5" x2="139.5" y2="99.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="139.5" y1="99.5" x2="136.7" y2="131.4" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="136.7" y1="131.4" x2="147" y2="135.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="105.5" y1="99.5" x2="139.5" y2="99.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="139.5" y1="99.5" x2="136.7" y2="131.4" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="136.7" y1="131.4" x2="147" y2="135.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="105.5" y1="62.5" x2="94.2" y2="83.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="94.2" y1="83.7" x2="108.9" y2="100" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="108.9" y1="100" x2="112.3" y2="103.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="105.5" y1="62.5" x2="94.2" y2="83.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="94.2" y1="83.7" x2="108.9" y2="100" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="108.9" y1="100" x2="112.3" y2="103.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'lauf-abc-seitgalopp': {
    media: {
      exercise_id: 'lauf-abc-seitgalopp',
      images: [
        {
          kind: 'start_position',
          file: 'lauf-abc-seitgalopp-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – seitlich zur Laufrichtung, Füße etwa schulterbreit, Knie leicht gebeugt, Arme seitlich auf Schulterhöhe.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="108,63 132,63 128,101 112,101" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="47" r="9" fill="{figure}"/><line x1="114" y1="101" x2="105.8" y2="134" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="105.8" y1="134" x2="100.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="100.2" y1="165.5" x2="95.6" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="101" x2="105.8" y2="134" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="105.8" y1="134" x2="100.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="100.2" y1="165.5" x2="95.6" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="101" x2="134.2" y2="134" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="134.2" y1="134" x2="139.8" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="139.8" y1="165.5" x2="144.4" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="101" x2="134.2" y2="134" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="134.2" y1="134" x2="139.8" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="139.8" y1="165.5" x2="144.4" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="64" x2="84.8" y2="70.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="84.8" y1="70.2" x2="63.6" y2="75.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="63.6" y1="75.9" x2="58.7" y2="77.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="64" x2="84.8" y2="70.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="84.8" y1="70.2" x2="63.6" y2="75.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="63.6" y1="75.9" x2="58.7" y2="77.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="64" x2="155.2" y2="70.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="155.2" y1="70.2" x2="176.4" y2="75.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="176.4" y1="75.9" x2="181.3" y2="77.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="64" x2="155.2" y2="70.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="155.2" y1="70.2" x2="176.4" y2="75.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="176.4" y1="75.9" x2="181.3" y2="77.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'lauf-abc-skippings': {
    media: {
      exercise_id: 'lauf-abc-skippings',
      images: [
        {
          kind: 'start_position',
          file: 'lauf-abc-skippings-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht auf einem Bein, das andere Knie leicht nach vorn gehoben, Arme angewinkelt wie beim Laufen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="107.8" y1="99.5" x2="107.8" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="107.8" y1="133.5" x2="107.8" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="107.8" y1="165.5" x2="118.8" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="107.8" y1="62.5" x2="119.1" y2="83.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="119.1" y1="83.7" x2="140" y2="76.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="140" y1="76.9" x2="144.7" y2="75.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="99.8,61.5 115.8,61.5 115.3,99.5 100.3,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="107.8" cy="45.5" r="9" fill="{figure}"/><line x1="107.8" y1="99.5" x2="133.8" y2="121.4" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="133.8" y1="121.4" x2="131" y2="153.2" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="131" y1="153.2" x2="141.4" y2="157" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="107.8" y1="99.5" x2="133.8" y2="121.4" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="133.8" y1="121.4" x2="131" y2="153.2" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="131" y1="153.2" x2="141.4" y2="157" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="107.8" y1="62.5" x2="96.5" y2="83.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="96.5" y1="83.7" x2="111.2" y2="100" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="111.2" y1="100" x2="114.6" y2="103.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="107.8" y1="62.5" x2="96.5" y2="83.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="96.5" y1="83.7" x2="111.2" y2="100" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="111.2" y1="100" x2="114.6" y2="103.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'lauf-abc-ueberkreuzlauf': {
    media: {
      exercise_id: 'lauf-abc-ueberkreuzlauf',
      images: [
        {
          kind: 'start_position',
          file: 'lauf-abc-ueberkreuzlauf-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – seitlich zur Laufrichtung, ein Bein vor dem anderen gekreuzt, Arme seitlich leicht gehoben.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="108,62.5 132,62.5 128,100.5 112,100.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="46.5" r="9" fill="{figure}"/><line x1="114" y1="100.5" x2="121.1" y2="133.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="121.1" y1="133.8" x2="115.5" y2="165.3" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="115.5" y1="165.3" x2="110.9" y2="167" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="100.5" x2="121.1" y2="133.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="121.1" y1="133.8" x2="115.5" y2="165.3" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="115.5" y1="165.3" x2="110.9" y2="167" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="100.5" x2="120.1" y2="134" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120.1" y1="134" x2="125.7" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="125.7" y1="165.5" x2="130.3" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="100.5" x2="120.1" y2="134" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120.1" y1="134" x2="125.7" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="125.7" y1="165.5" x2="130.3" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="63.5" x2="85.4" y2="71.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="85.4" y1="71.7" x2="64.8" y2="79.2" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="64.8" y1="79.2" x2="60.1" y2="80.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="63.5" x2="85.4" y2="71.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="85.4" y1="71.7" x2="64.8" y2="79.2" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="64.8" y1="79.2" x2="60.1" y2="80.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="63.5" x2="154.6" y2="71.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="154.6" y1="71.7" x2="175.2" y2="79.2" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="175.2" y1="79.2" x2="179.9" y2="80.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="63.5" x2="154.6" y2="71.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="154.6" y1="71.7" x2="175.2" y2="79.2" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="175.2" y1="79.2" x2="179.9" y2="80.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  liegestuetz: {
    media: {
      exercise_id: 'liegestuetz',
      images: [
        {
          kind: 'start_position',
          file: 'liegestuetz-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz von der Seite, Arme gestreckt, Hände unter den Schultern, Körper vom Kopf bis zu den Fersen gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="123.3" y1="133.2" x2="91.6" y2="145.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="91.6" y1="145.3" x2="61.5" y2="156.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="61.5" y1="156.3" x2="64.3" y2="166.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="159.3" y2="144.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="159.3" y1="144.5" x2="158.9" y2="166.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="158.9" y1="166.5" x2="163.9" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="156.3,112.6 161.8,127.7 125.9,140.2 120.7,126.1" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="174.2" cy="115.1" r="9" fill="{figure}"/><line x1="123.3" y1="133.2" x2="91.4" y2="144.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="91.4" y1="144.8" x2="61.3" y2="155.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="61.3" y1="155.7" x2="64.1" y2="166.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="123.3" y1="133.2" x2="91.4" y2="144.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="91.4" y1="144.8" x2="61.3" y2="155.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="61.3" y1="155.7" x2="64.1" y2="166.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="158.1" y2="144.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="158.1" y1="144.5" x2="158.1" y2="166.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="158.1" y1="166.5" x2="163.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="158.1" y2="144.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="158.1" y1="144.5" x2="158.1" y2="166.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="158.1" y1="166.5" x2="163.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'liegestuetz-erhoeht': {
    media: {
      exercise_id: 'liegestuetz-erhoeht',
      images: [
        {
          kind: 'start_position',
          file: 'liegestuetz-erhoeht-start.svg',
          alt_de:
            'Ausgangsposition: Hände auf einer Tischkante, Arme gestreckt, Füße hinten am Boden, Körper bildet eine gerade, schräge Linie.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="140" y1="170" x2="140" y2="115" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="194" y1="170" x2="194" y2="115" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="136" y1="115" x2="198" y2="115" stroke="{furnitureLine}" stroke-width="6" stroke-linecap="round"/><line x1="86" y1="107.2" x2="64.6" y2="133.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="64.6" y1="133.6" x2="43.6" y2="157.8" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="43.6" y1="157.8" x2="49.1" y2="167.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="109.7" y1="78.9" x2="118.9" y2="101.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="118.9" y1="101.1" x2="139" y2="110" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="139" y1="110" x2="144" y2="110" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="104.3,72.9 116.5,83.2 91.7,112 80.2,102.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="121" cy="66.2" r="9" fill="{figure}"/><line x1="86" y1="107.2" x2="64.1" y2="133.2" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="64.1" y1="133.2" x2="43.5" y2="157.8" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="43.5" y1="157.8" x2="49" y2="167.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="86" y1="107.2" x2="64.1" y2="133.2" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="64.1" y1="133.2" x2="43.5" y2="157.8" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="43.5" y1="157.8" x2="49" y2="167.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="109.7" y1="78.9" x2="120.1" y2="100.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="120.1" y1="100.5" x2="140" y2="110" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="140" y1="110" x2="145" y2="110" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="109.7" y1="78.9" x2="120.1" y2="100.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="120.1" y1="100.5" x2="140" y2="110" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="140" y1="110" x2="145" y2="110" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'liegestuetz-fuesse-erhoeht': {
    media: {
      exercise_id: 'liegestuetz-fuesse-erhoeht',
      images: [
        {
          kind: 'start_position',
          file: 'liegestuetz-fuesse-erhoeht-start.svg',
          alt_de:
            'Ausgangsposition: Liegestütz mit den Füßen auf einem Stuhl, Hände unter den Schultern am Boden, Arme gestreckt, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="49.8" y1="170" x2="49.8" y2="106.5" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="77.8" y1="170" x2="77.8" y2="140.5" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="49.8" y1="140.5" x2="77.8" y2="140.5" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><line x1="129.8" y1="122.5" x2="95.8" y2="123.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="95.8" y1="123.7" x2="63.8" y2="125.4" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="63.8" y1="125.4" x2="66.7" y2="136" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="166.7" y1="121.2" x2="167.6" y2="145.2" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="167.6" y1="145.2" x2="167.2" y2="167.2" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="167.2" y1="167.2" x2="172.2" y2="167.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="167.5,113.2 168,129.2 130,130 129.5,115" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="183.7" cy="121.1" r="9" fill="{figure}"/><line x1="129.8" y1="122.5" x2="95.8" y2="123.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="95.8" y1="123.7" x2="63.8" y2="124.8" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="63.8" y1="124.8" x2="66.6" y2="135.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="129.8" y1="122.5" x2="95.8" y2="123.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="95.8" y1="123.7" x2="63.8" y2="124.8" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="63.8" y1="124.8" x2="66.6" y2="135.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="166.7" y1="121.2" x2="166.7" y2="145.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="166.7" y1="145.2" x2="166.7" y2="167.2" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="166.7" y1="167.2" x2="171.7" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="166.7" y1="121.2" x2="166.7" y2="145.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="166.7" y1="145.2" x2="166.7" y2="167.2" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="166.7" y1="167.2" x2="171.7" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'marschieren-auf-der-stelle': {
    media: {
      exercise_id: 'marschieren-auf-der-stelle',
      images: [
        {
          kind: 'start_position',
          file: 'marschieren-auf-der-stelle-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – aufrecht stehen, Füße hüftbreit, Arme locker neben dem Körper.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="108,61.5 132,61.5 128,99.5 112,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="45.5" r="9" fill="{figure}"/><line x1="114" y1="99.5" x2="115.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="115.2" y1="133.5" x2="115.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="115.2" y1="165.5" x2="110.5" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="99.5" x2="115.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="115.2" y1="133.5" x2="115.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="115.2" y1="165.5" x2="110.5" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.8" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="124.8" y1="133.5" x2="124.8" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="124.8" y1="165.5" x2="129.5" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.8" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="124.8" y1="133.5" x2="124.8" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="124.8" y1="165.5" x2="129.5" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="62.5" x2="105.5" y2="86.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="105.5" y1="86.4" x2="104.3" y2="108.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="104.3" y1="108.4" x2="104.1" y2="113.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="62.5" x2="105.5" y2="86.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="105.5" y1="86.4" x2="104.3" y2="108.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="104.3" y1="108.4" x2="104.1" y2="113.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="62.5" x2="134.5" y2="86.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="134.5" y1="86.4" x2="135.7" y2="108.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="135.7" y1="108.4" x2="135.9" y2="113.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="62.5" x2="134.5" y2="86.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="134.5" y1="86.4" x2="135.7" y2="108.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="135.7" y1="108.4" x2="135.9" y2="113.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'muscle-up': {
    media: {
      exercise_id: 'muscle-up',
      images: [
        {
          kind: 'start_position',
          file: 'muscle-up-start.svg',
          alt_de:
            'Ausgangsposition: gestreckter Hang an der Stange, Hände etwa schulterbreit, Körper ruhig, Füße über dem Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="123.7,6 123.7,6.5 137.7,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="128.5" y2="131.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="128.5" y1="131.7" x2="102.3" y2="150.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="102.3" y1="150.1" x2="100.4" y2="160.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132" y2="37.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="132" y1="37.1" x2="132.4" y2="15.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="132.4" y1="15.1" x2="132.6" y2="10.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122.7,60.5 138.7,59.6 140.2,97.6 125.2,98.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="129.8" cy="44.1" r="10.6" fill="{gap}"/><circle cx="129.8" cy="44.1" r="9" fill="{figure}"/><circle cx="137.7" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'muscle-up-negativ': {
    media: {
      exercise_id: 'muscle-up-negativ',
      images: [
        {
          kind: 'start_position',
          file: 'muscle-up-negativ-start.svg',
          alt_de:
            'Ausgangsposition: im Stütz über der Stange, Arme gestreckt, Stange auf Hüfthöhe; die Füße stehen noch auf einem Kasten.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="123,6 123,80 137,86" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="92" y="146" width="56" height="24" rx="1.5" fill="{furniture}"/><line x1="126" y1="78" x2="124.8" y2="112" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="124.8" y1="112" x2="120.4" y2="143.7" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="120.4" y1="143.7" x2="131.4" y2="143.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="129.9" y1="41.2" x2="126.8" y2="65" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="126.8" y1="65" x2="136" y2="85" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="136" y1="85" x2="136" y2="90" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122,39.4 137.9,41 133.5,78.8 118.5,77.2" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="131.6" cy="24.3" r="9" fill="{figure}"/><line x1="126" y1="78" x2="123" y2="111.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="123" y1="111.9" x2="120.2" y2="143.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="120.2" y1="143.7" x2="131.2" y2="143.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="78" x2="123" y2="111.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="123" y1="111.9" x2="120.2" y2="143.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="120.2" y1="143.7" x2="131.2" y2="143.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="129.9" y1="41.2" x2="127.6" y2="65.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="127.6" y1="65.1" x2="137" y2="85" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="137" y1="85" x2="137" y2="90" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="129.9" y1="41.2" x2="127.6" y2="65.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="127.6" y1="65.1" x2="137" y2="85" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="137" y1="85" x2="137" y2="90" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="137" cy="86" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'nordic-curl-assistiert': {
    media: {
      exercise_id: 'nordic-curl-assistiert',
      images: [
        {
          kind: 'start_position',
          file: 'nordic-curl-assistiert-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht auf einer weichen Unterlage knien, Fersen unter einem schweren Sofa verankert, Körper vom Knie bis zum Kopf gerade, Hände vor der Brust.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="143.6" y="167" width="22" height="3" rx="1.5" fill="{equipSoft}"/><rect x="67.6" y="134" width="70" height="24" rx="4" fill="{furniture}"/><rect x="67.6" y="108" width="14" height="50" rx="5" fill="{furniture}"/><rect x="70.6" y="158" width="4" height="12" fill="{furnitureLine}"/><rect x="130.6" y="158" width="4" height="12" fill="{furnitureLine}"/><line x1="153.6" y1="130.5" x2="152.4" y2="164.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="152.4" y1="164.5" x2="120.4" y2="164.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="120.4" y1="164.5" x2="109.4" y2="164.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="153.6" y1="93.5" x2="156.1" y2="117.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="156.1" y1="117.4" x2="167.8" y2="98.7" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="167.8" y1="98.7" x2="168.6" y2="93.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="145.6,92.5 161.6,92.5 161.1,130.5 146.1,130.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="153.6" cy="76.5" r="9" fill="{figure}"/><line x1="153.6" y1="130.5" x2="153.6" y2="164.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="153.6" y1="164.5" x2="121.6" y2="164.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="121.6" y1="164.5" x2="110.6" y2="164.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="153.6" y1="130.5" x2="153.6" y2="164.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="153.6" y1="164.5" x2="121.6" y2="164.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="121.6" y1="164.5" x2="110.6" y2="164.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="153.6" y1="93.5" x2="157.8" y2="117.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="157.8" y1="117.1" x2="168.8" y2="98.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="168.8" y1="98.1" x2="169.6" y2="93.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="153.6" y1="93.5" x2="157.8" y2="117.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="157.8" y1="117.1" x2="168.8" y2="98.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="168.8" y1="98.1" x2="169.6" y2="93.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'oberschenkel-vorderseite-dehnen': {
    media: {
      exercise_id: 'oberschenkel-vorderseite-dehnen',
      images: [
        {
          kind: 'start_position',
          file: 'oberschenkel-vorderseite-dehnen-start.svg',
          alt_de:
            'Ausgangsposition: auf einem Bein neben einer Wand stehen, eine Hand an der Wand, die andere Hand hält den Fuß des gebeugten Beins hinter dem Gesäß.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="158.6" y="20" width="8" height="150" fill="{furniture}"/><line x1="112.6" y1="99.5" x2="105.5" y2="132.8" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="105.5" y1="132.8" x2="87.2" y2="106.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="87.2" y1="106.5" x2="76.2" y2="106.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="112.6" y1="62.5" x2="101.3" y2="83.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="101.3" y1="83.7" x2="97.5" y2="105.4" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="97.5" y1="105.4" x2="96.6" y2="110.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="104.6,61.5 120.6,61.5 120.1,99.5 105.1,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="112.6" cy="45.5" r="9" fill="{figure}"/><line x1="112.6" y1="99.5" x2="113.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="113.2" y1="133.5" x2="113.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="113.2" y1="165.5" x2="124.2" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="112.6" y1="99.5" x2="113.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="113.2" y1="133.5" x2="113.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="113.2" y1="165.5" x2="124.2" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="112.6" y1="62.5" x2="136.1" y2="67.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="136.1" y1="67.5" x2="158" y2="66.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="158" y1="66.7" x2="158.9" y2="61.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="112.6" y1="62.5" x2="136.1" y2="67.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="136.1" y1="67.5" x2="158" y2="66.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="158" y1="66.7" x2="158.9" y2="61.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'pallof-press-band': {
    media: {
      exercise_id: 'pallof-press-band',
      images: [
        {
          kind: 'start_position',
          file: 'pallof-press-band-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – seitlich zum Befestigungspunkt stehen, Widerstandsband auf Brusthöhe, beide Hände halten es vor der Brust.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="51.9" y="20" width="8" height="150" fill="{furniture}"/><polygon points="151.9,61.5 175.9,61.5 171.9,99.5 155.9,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="163.9" cy="45.5" r="9" fill="{figure}"/><line x1="157.9" y1="99.5" x2="156.7" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="156.7" y1="133.5" x2="156.7" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="156.7" y1="165.5" x2="152.1" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="157.9" y1="99.5" x2="156.7" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="156.7" y1="133.5" x2="156.7" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="156.7" y1="165.5" x2="152.1" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="169.9" y1="99.5" x2="171.1" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="171.1" y1="133.5" x2="171.1" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="171.1" y1="165.5" x2="175.7" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="169.9" y1="99.5" x2="171.1" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="171.1" y1="133.5" x2="171.1" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="171.1" y1="165.5" x2="175.7" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="151.9" y1="62.5" x2="143.7" y2="85.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="143.7" y1="85.1" x2="164.1" y2="76.8" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="164.1" y1="76.8" x2="169" y2="76" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="151.9" y1="62.5" x2="143.7" y2="85.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="143.7" y1="85.1" x2="164.1" y2="76.8" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="164.1" y1="76.8" x2="169" y2="76" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="175.9" y1="62.5" x2="184.1" y2="85.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="184.1" y1="85.1" x2="163.7" y2="76.8" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="163.7" y1="76.8" x2="158.8" y2="76" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="175.9" y1="62.5" x2="184.1" y2="85.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="184.1" y1="85.1" x2="163.7" y2="76.8" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="163.7" y1="76.8" x2="158.8" y2="76" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="59.9" y1="84" x2="164.1" y2="76.8" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
  },
  'pike-liegestuetz': {
    media: {
      exercise_id: 'pike-liegestuetz',
      images: [
        {
          kind: 'start_position',
          file: 'pike-liegestuetz-start.svg',
          alt_de:
            'Ausgangsposition: umgedrehtes V – Hände schulterbreit am Boden, Arme gestreckt, Hüfte hoch, Beine gestreckt, Kopf zwischen den Armen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="107.7" y1="98.6" x2="96.1" y2="130.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="96.1" y1="130.6" x2="83.6" y2="160.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="83.6" y1="160.1" x2="92.6" y2="166.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="133.9" y1="124.8" x2="144.8" y2="146.2" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="144.8" y1="146.2" x2="153.7" y2="166.3" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="153.7" y1="166.3" x2="158.7" y2="166.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="140.3,119.9 128.9,131.2 102.4,104 113,93.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="143" cy="139.1" r="9" fill="{figure}"/><line x1="107.7" y1="98.6" x2="95" y2="130.2" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="95" y1="130.2" x2="83" y2="159.8" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="83" y1="159.8" x2="92" y2="166.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="107.7" y1="98.6" x2="95" y2="130.2" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="95" y1="130.2" x2="83" y2="159.8" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="83" y1="159.8" x2="92" y2="166.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="133.9" y1="124.8" x2="144" y2="146.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="144" y1="146.6" x2="153.3" y2="166.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="153.3" y1="166.5" x2="158.3" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="133.9" y1="124.8" x2="144" y2="146.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="144" y1="146.6" x2="153.3" y2="166.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="153.3" y1="166.5" x2="158.3" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'pistol-kniebeuge': {
    media: {
      exercise_id: 'pistol-kniebeuge',
      images: [
        {
          kind: 'start_position',
          file: 'pistol-kniebeuge-start.svg',
          alt_de:
            'Ausgangsposition: auf einem Bein stehen, das andere Bein gestreckt leicht angehoben, Arme waagerecht nach vorn.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="88.5" y1="99.5" x2="88.5" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="88.5" y1="133.5" x2="88.5" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="88.5" y1="165.5" x2="99.5" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="87.2" y1="62.5" x2="111.2" y2="62.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="111.2" y1="62.5" x2="133.2" y2="62.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="133.2" y1="62.5" x2="138.2" y2="62.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="79.2,61.8 95.2,61.2 96,99.2 81,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="86.6" cy="45.5" r="9" fill="{figure}"/><line x1="88.5" y1="99.5" x2="120" y2="112.2" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120" y1="112.2" x2="149.7" y2="124.2" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="149.7" y1="124.2" x2="160.5" y2="122.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="88.5" y1="99.5" x2="120" y2="112.2" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120" y1="112.2" x2="149.7" y2="124.2" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="149.7" y1="124.2" x2="160.5" y2="122.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="87.2" y1="62.5" x2="111.2" y2="61.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="111.2" y1="61.7" x2="133.2" y2="60.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="133.2" y1="60.9" x2="138.2" y2="60.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="87.2" y1="62.5" x2="111.2" y2="61.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="111.2" y1="61.7" x2="133.2" y2="60.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="133.2" y1="60.9" x2="138.2" y2="60.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'pistol-kniebeuge-halt': {
    media: {
      exercise_id: 'pistol-kniebeuge-halt',
      images: [
        {
          kind: 'start_position',
          file: 'pistol-kniebeuge-halt-start.svg',
          alt_de:
            'Ausgangsposition: auf einem Bein neben einem Türrahmen stehen, eine Hand hält den Rahmen auf Hüfthöhe, das andere Bein leicht nach vorn gehoben.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="146" y="20" width="8" height="150" fill="{furniture}"/><line x1="90" y1="99.5" x2="90" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="90" y1="133.5" x2="90" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="90" y1="165.5" x2="101" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="88.7" y1="62.5" x2="92.9" y2="86.2" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="92.9" y1="86.2" x2="94.8" y2="108.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="94.8" y1="108.1" x2="95.2" y2="113.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="80.7,61.8 96.7,61.2 97.5,99.2 82.5,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="88.1" cy="45.5" r="9" fill="{figure}"/><line x1="90" y1="99.5" x2="120" y2="115.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="120" y1="115.5" x2="148.3" y2="130.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="148.3" y1="130.5" x2="159.1" y2="128.6" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="90" y1="99.5" x2="120" y2="115.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="120" y1="115.5" x2="148.3" y2="130.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="148.3" y1="130.5" x2="159.1" y2="128.6" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="88.7" y1="62.5" x2="112.3" y2="66.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="112.3" y1="66.7" x2="134.3" y2="66.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="134.3" y1="66.7" x2="139.3" y2="66.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="88.7" y1="62.5" x2="112.3" y2="66.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="112.3" y1="66.7" x2="134.3" y2="66.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="134.3" y1="66.7" x2="139.3" y2="66.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'pistol-kniebeuge-kasten': {
    media: {
      exercise_id: 'pistol-kniebeuge-kasten',
      images: [
        {
          kind: 'start_position',
          file: 'pistol-kniebeuge-kasten-start.svg',
          alt_de:
            'Ausgangsposition: auf einem Bein vor einem Stuhl stehen, das andere Bein und die Arme nach vorn gestreckt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="61.3" y1="170" x2="61.3" y2="103" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="89.3" y1="170" x2="89.3" y2="137" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="61.3" y1="137" x2="89.3" y2="137" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><line x1="109.3" y1="99.5" x2="109.3" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="109.3" y1="133.5" x2="109.3" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="109.3" y1="165.5" x2="120.3" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="62.5" x2="132" y2="62.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="132" y1="62.5" x2="154" y2="62.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="154" y1="62.5" x2="159" y2="62.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="100,61.8 116,61.2 116.8,99.2 101.8,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="107.4" cy="45.5" r="9" fill="{figure}"/><line x1="109.3" y1="99.5" x2="139.3" y2="115.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="139.3" y1="115.5" x2="167.6" y2="130.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="167.6" y1="130.5" x2="178.4" y2="128.6" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="109.3" y1="99.5" x2="139.3" y2="115.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="139.3" y1="115.5" x2="167.6" y2="130.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="167.6" y1="130.5" x2="178.4" y2="128.6" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="62.5" x2="132" y2="61.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="132" y1="61.7" x2="154" y2="60.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="154" y1="60.9" x2="159" y2="60.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="62.5" x2="132" y2="61.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="132" y1="61.7" x2="154" y2="60.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="154" y1="60.9" x2="159" y2="60.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'planche-lehne': {
    media: {
      exercise_id: 'planche-lehne',
      images: [
        {
          kind: 'start_position',
          file: 'planche-lehne-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz, Schultern deutlich vor die Hände geschoben, Arme gestreckt, Finger zeigen nach hinten.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="123.5" y1="134" x2="91.2" y2="144.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="91.2" y1="144.5" x2="60.6" y2="153.8" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="60.6" y1="153.8" x2="63.4" y2="164.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.9" y1="123.1" x2="151.5" y2="146" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="151.5" y1="146" x2="143.6" y2="166.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="143.6" y1="166.5" x2="138.6" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="157.5,115.2 162.2,130.5 125.7,141.1 121.3,126.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="175.1" cy="117.9" r="9" fill="{figure}"/><line x1="123.5" y1="134" x2="91" y2="143.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="91" y1="143.9" x2="60.4" y2="153.3" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="60.4" y1="153.3" x2="63.3" y2="163.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="123.5" y1="134" x2="91" y2="143.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="91" y1="143.9" x2="60.4" y2="153.3" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="60.4" y1="153.3" x2="63.3" y2="163.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.9" y1="123.1" x2="150.7" y2="145.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="150.7" y1="145.7" x2="143.2" y2="166.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="143.2" y1="166.4" x2="138.2" y2="166.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="158.9" y1="123.1" x2="150.7" y2="145.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="150.7" y1="145.7" x2="143.2" y2="166.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="143.2" y1="166.4" x2="138.2" y2="166.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'pseudo-planche-liegestuetz': {
    media: {
      exercise_id: 'pseudo-planche-liegestuetz',
      images: [
        {
          kind: 'start_position',
          file: 'pseudo-planche-liegestuetz-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz mit den Händen auf Hüfthöhe, Schultern vor den Händen, Arme gestreckt, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="123.5" y1="134" x2="91.2" y2="144.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="91.2" y1="144.5" x2="60.6" y2="153.8" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="60.6" y1="153.8" x2="63.4" y2="164.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.9" y1="123.1" x2="151.5" y2="146" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="151.5" y1="146" x2="143.6" y2="166.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="143.6" y1="166.5" x2="138.6" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="157.5,115.2 162.2,130.5 125.7,141.1 121.3,126.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="175.1" cy="117.9" r="9" fill="{figure}"/><line x1="123.5" y1="134" x2="91" y2="143.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="91" y1="143.9" x2="60.4" y2="153.3" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="60.4" y1="153.3" x2="63.3" y2="163.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="123.5" y1="134" x2="91" y2="143.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="91" y1="143.9" x2="60.4" y2="153.3" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="60.4" y1="153.3" x2="63.3" y2="163.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.9" y1="123.1" x2="150.7" y2="145.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="150.7" y1="145.7" x2="143.2" y2="166.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="143.2" y1="166.4" x2="138.2" y2="166.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="158.9" y1="123.1" x2="150.7" y2="145.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="150.7" y1="145.7" x2="143.2" y2="166.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="143.2" y1="166.4" x2="138.2" y2="166.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'rdl-einbeinig-koerpergewicht': {
    media: {
      exercise_id: 'rdl-einbeinig-koerpergewicht',
      images: [
        {
          kind: 'start_position',
          file: 'rdl-einbeinig-koerpergewicht-start.svg',
          alt_de:
            'Ausgangsposition: auf einem Bein stehen, Knie leicht gebeugt, das freie Bein knapp über dem Boden, eine Hand an der Wand neben dir.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="70" y="30" width="100" height="140" rx="3" fill="{furniture}"/><line x1="120" y1="99.8" x2="114.1" y2="133.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="114.1" y1="133.2" x2="102.1" y2="162.9" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="102.1" y1="162.9" x2="112.4" y2="166.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="120" y1="62.8" x2="132" y2="83.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="132" y1="83.5" x2="139.5" y2="104.2" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="139.5" y1="104.2" x2="141.2" y2="108.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="112,61.8 128,61.8 127.5,99.8 112.5,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="45.8" r="9" fill="{figure}"/><line x1="120" y1="99.8" x2="123.6" y2="133.6" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="123.6" y1="133.6" x2="121.3" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="121.3" y1="165.5" x2="132.3" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="120" y1="99.8" x2="123.6" y2="133.6" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="123.6" y1="133.6" x2="121.3" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="121.3" y1="165.5" x2="132.3" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="120" y1="62.8" x2="121.7" y2="86.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="121.7" y1="86.7" x2="122.4" y2="108.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="122.4" y1="108.7" x2="122.6" y2="113.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="120" y1="62.8" x2="121.7" y2="86.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="121.7" y1="86.7" x2="122.4" y2="108.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="122.4" y1="108.7" x2="122.6" y2="113.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'reverse-fly-kurzhantel': {
    media: {
      exercise_id: 'reverse-fly-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'reverse-fly-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: Oberkörper mit geradem Rücken weit vorgebeugt, Knie gebeugt, Arme hängen leicht gebeugt unter den Schultern, je eine leichte Kurzhantel.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="134.4" y1="133.4" x2="120.4" y2="133.4" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="134.4" y1="127.9" x2="134.4" y2="138.9" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="120.4" y1="127.9" x2="120.4" y2="138.9" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="94.1" y1="101.5" x2="105.2" y2="133.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="105.2" y1="133.7" x2="101.9" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="101.9" y1="165.5" x2="112.9" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.7" y1="85.9" x2="124.3" y2="109.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="124.3" y1="109.7" x2="127.4" y2="131.4" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="127.4" y1="131.4" x2="127.8" y2="136.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="125.2,78.2 132,92.7 97.3,108.3 91,94.7" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="142.5" cy="77.6" r="9" fill="{figure}"/><line x1="94.1" y1="101.5" x2="106.9" y2="133.1" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="106.9" y1="133.1" x2="102.4" y2="164.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="102.4" y1="164.7" x2="113.4" y2="164.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="94.1" y1="101.5" x2="106.9" y2="133.1" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="106.9" y1="133.1" x2="102.4" y2="164.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="102.4" y1="164.7" x2="113.4" y2="164.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.7" y1="85.9" x2="125.2" y2="109.8" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="125.2" y1="109.8" x2="129" y2="131.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="129" y1="131.4" x2="129.4" y2="136.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="127.7" y1="85.9" x2="125.2" y2="109.8" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="125.2" y1="109.8" x2="129" y2="131.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="129" y1="131.4" x2="129.4" y2="136.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="136" y1="133.4" x2="122" y2="133.4" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="136" y1="127.9" x2="136" y2="138.9" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="122" y1="127.9" x2="122" y2="138.9" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/></svg>',
    },
  },
  'ring-liegestuetz': {
    media: {
      exercise_id: 'ring-liegestuetz',
      images: [
        {
          kind: 'start_position',
          file: 'ring-liegestuetz-start.svg',
          alt_de:
            'Ausgangsposition: schräger Liegestütz, Hände in tief hängenden Ringen, Arme gestreckt, Füße am Boden, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="136.5" y1="6" x2="152.4" y2="148.3" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="152.4" cy="148.3" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/><line x1="134.5" y1="6" x2="153.3" y2="148.2" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="153.3" cy="148.2" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/><line x1="122.5" y1="124" x2="95.3" y2="144.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="95.3" y1="144.5" x2="69.4" y2="163.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="69.4" y1="163.3" x2="78.9" y2="168.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="152.4" y1="102.3" x2="153.7" y2="126.2" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="153.7" y1="126.2" x2="153.3" y2="148.2" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="153.3" y1="148.2" x2="158.3" y2="148.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="148.5,95.2 157.9,108.1 126.9,130.1 118.1,117.9" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="166.4" cy="92.7" r="9" fill="{figure}"/><line x1="122.5" y1="124" x2="95" y2="144" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="95" y1="144" x2="69.1" y2="162.8" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="69.1" y1="162.8" x2="78.6" y2="168.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="122.5" y1="124" x2="95" y2="144" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="95" y1="144" x2="69.1" y2="162.8" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="69.1" y1="162.8" x2="78.6" y2="168.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="152.4" y1="102.3" x2="152.4" y2="126.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="152.4" y1="126.3" x2="152.4" y2="148.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="152.4" y1="148.3" x2="157.4" y2="148.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="152.4" y1="102.3" x2="152.4" y2="126.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="152.4" y1="126.3" x2="152.4" y2="148.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="152.4" y1="148.3" x2="157.4" y2="148.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'ring-rudern': {
    media: {
      exercise_id: 'ring-rudern',
      images: [
        {
          kind: 'start_position',
          file: 'ring-rudern-start.svg',
          alt_de:
            'Ausgangsposition: Gesicht zu den Ringen, Hände greifen die Ringe, Arme gestreckt, Körper gerade nach hinten gelehnt, Fersen am Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="167.9" y1="6" x2="127" y2="60.1" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="127" cy="60.1" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/><line x1="107.9" y1="113" x2="126.9" y2="141.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="126.9" y1="141.2" x2="145.7" y2="167.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="145.7" y1="167.1" x2="156.7" y2="167.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="86.6" y1="82.7" x2="110.6" y2="81.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="110.6" y1="81.3" x2="122.9" y2="63" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="122.9" y1="63" x2="127" y2="60.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="79.5,86.5 92.6,77.3 114,108.7 101.7,117.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="78.3" cy="67.9" r="9" fill="{figure}"/><line x1="107.9" y1="113" x2="127.4" y2="140.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="127.4" y1="140.9" x2="145.7" y2="167.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="145.7" y1="167.1" x2="156.7" y2="167.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="107.9" y1="113" x2="127.4" y2="140.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="127.4" y1="140.9" x2="145.7" y2="167.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="145.7" y1="167.1" x2="156.7" y2="167.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="86.6" y1="82.7" x2="110.4" y2="79.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="110.4" y1="79.4" x2="123.9" y2="62" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="123.9" y1="62" x2="128" y2="59.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="86.6" y1="82.7" x2="110.4" y2="79.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="110.4" y1="79.4" x2="123.9" y2="62" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="123.9" y1="62" x2="128" y2="59.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="169.9" y1="6" x2="128" y2="59.1" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="128" cy="59.1" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/></svg>',
    },
  },
  'ring-stuetz': {
    media: {
      exercise_id: 'ring-stuetz',
      images: [
        {
          kind: 'start_position',
          file: 'ring-stuetz-start.svg',
          alt_de:
            'Ausgangsposition: Stütz an den Ringen, Arme gestreckt, Ringe dicht neben der Hüfte, Beine angewinkelt über dem Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="144.4" y1="6" x2="132.3" y2="87.7" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="132.3" cy="87.7" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/><line x1="142.4" y1="6" x2="131.3" y2="87.8" stroke="{equipSoft}" stroke-width="1.6" stroke-linecap="round"/><circle cx="131.3" cy="87.8" r="5" fill="none" stroke="{equip}" stroke-width="2.2"/><line x1="128.4" y1="74" x2="132" y2="107.8" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="132" y1="107.8" x2="103" y2="121.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="103" y1="121.3" x2="97.5" y2="130.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.2" y1="37" x2="128.9" y2="61" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="128.9" y1="61" x2="131.3" y2="82.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="131.3" y1="82.8" x2="131.3" y2="87.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="119.1,36.3 135.1,35.7 135.9,73.7 121,74.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="126.6" cy="20" r="9" fill="{figure}"/><line x1="128.4" y1="74" x2="134.4" y2="107.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="134.4" y1="107.5" x2="104.3" y2="118.4" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="104.3" y1="118.4" x2="98.8" y2="128" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.4" y1="74" x2="134.4" y2="107.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="134.4" y1="107.5" x2="104.3" y2="118.4" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="104.3" y1="118.4" x2="98.8" y2="128" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.2" y1="37" x2="129.4" y2="60.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="129.4" y1="60.9" x2="132.3" y2="82.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="132.3" y1="82.7" x2="132.3" y2="87.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="127.2" y1="37" x2="129.4" y2="60.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="129.4" y1="60.9" x2="132.3" y2="82.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="132.3" y1="82.7" x2="132.3" y2="87.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'rudern-band': {
    media: {
      exercise_id: 'rudern-band',
      images: [
        {
          kind: 'start_position',
          file: 'rudern-band-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Arme auf Brusthöhe nach vorn gestreckt, Widerstandsband an einem Türanker vor dir befestigt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="159.8" y="20" width="7" height="150" fill="{furniture}"/><line x1="83.8" y1="99.5" x2="82" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="82" y1="133.5" x2="82.5" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="82.5" y1="165.5" x2="93.5" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="83.8" y1="62.5" x2="107.6" y2="65" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="107.6" y1="65" x2="129.6" y2="66.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="129.6" y1="66.6" x2="134.6" y2="66.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="75.8,61.5 91.8,61.5 91.3,99.5 76.3,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="83.8" cy="45.5" r="9" fill="{figure}"/><line x1="83.8" y1="99.5" x2="84.9" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="84.9" y1="133.5" x2="84.4" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="84.4" y1="165.5" x2="95.4" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="83.8" y1="99.5" x2="84.9" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="84.9" y1="133.5" x2="84.4" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="84.4" y1="165.5" x2="95.4" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="83.8" y1="62.5" x2="107.7" y2="64.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="107.7" y1="64.2" x2="129.7" y2="65.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="129.7" y1="65.4" x2="134.7" y2="65.6" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="83.8" y1="62.5" x2="107.7" y2="64.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="107.7" y1="64.2" x2="129.7" y2="65.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="129.7" y1="65.4" x2="134.7" y2="65.6" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="129.7" y1="65.4" x2="159.8" y2="72" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
  },
  'rumaenisches-kreuzheben-kurzhantel': {
    media: {
      exercise_id: 'rumaenisches-kreuzheben-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'rumaenisches-kreuzheben-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Knie leicht gebeugt, je eine Kurzhantel vor den Oberschenkeln, Füße hüftbreit.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><circle cx="120" cy="107.7" r="6" fill="{equip}"/><circle cx="120" cy="107.7" r="2" fill="{equipSoft}"/><line x1="117.1" y1="99.8" x2="121.2" y2="133.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="121.2" y1="133.6" x2="119" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="119" y1="165.5" x2="130" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="117.1" y1="62.8" x2="119.2" y2="86.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="119.2" y1="86.7" x2="120" y2="108.7" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="120" y1="108.7" x2="120.1" y2="113.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="109.1,61.8 125.1,61.8 124.6,99.8 109.6,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="117.1" cy="45.8" r="9" fill="{figure}"/><line x1="117.1" y1="99.8" x2="123" y2="133.3" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="123" y1="133.3" x2="119.7" y2="165.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="119.7" y1="165.1" x2="130.7" y2="165.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.1" y1="99.8" x2="123" y2="133.3" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="123" y1="133.3" x2="119.7" y2="165.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="119.7" y1="165.1" x2="130.7" y2="165.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="117.1" y1="62.8" x2="120.4" y2="86.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="120.4" y1="86.6" x2="122" y2="108.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="122" y1="108.5" x2="122.1" y2="113.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.1" y1="62.8" x2="120.4" y2="86.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="120.4" y1="86.6" x2="122" y2="108.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="122" y1="108.5" x2="122.1" y2="113.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="122" cy="107.5" r="6" fill="{equip}"/><circle cx="122" cy="107.5" r="2" fill="{equipSoft}"/></svg>',
    },
  },
  'rumaenisches-kreuzheben-langhantel': {
    media: {
      exercise_id: 'rumaenisches-kreuzheben-langhantel',
      images: [
        {
          kind: 'start_position',
          file: 'rumaenisches-kreuzheben-langhantel-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Knie leicht gebeugt, Langhantel mit gestreckten Armen vor den Oberschenkeln, Füße hüftbreit.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="115.1" y1="99.8" x2="119.3" y2="133.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="119.3" y1="133.6" x2="117" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="117" y1="165.5" x2="128" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="115.1" y1="62.8" x2="117.2" y2="86.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="117.2" y1="86.7" x2="118" y2="108.7" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="118" y1="108.7" x2="118.2" y2="113.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="107.1,61.8 123.1,61.8 122.6,99.8 107.6,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="115.1" cy="45.8" r="9" fill="{figure}"/><line x1="115.1" y1="99.8" x2="121" y2="133.3" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="121" y1="133.3" x2="117.7" y2="165.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="117.7" y1="165.1" x2="128.7" y2="165.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="115.1" y1="99.8" x2="121" y2="133.3" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="121" y1="133.3" x2="117.7" y2="165.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="117.7" y1="165.1" x2="128.7" y2="165.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="115.1" y1="62.8" x2="118.5" y2="86.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="118.5" y1="86.6" x2="120" y2="108.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="120" y1="108.5" x2="120.2" y2="113.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="115.1" y1="62.8" x2="118.5" y2="86.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="118.5" y1="86.6" x2="120" y2="108.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="120" y1="108.5" x2="120.2" y2="113.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="120" cy="109.5" r="14" fill="none" stroke="{equip}" stroke-width="3.5"/><circle cx="120" cy="109.5" r="3" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-atomic-liegestuetz': {
    media: {
      exercise_id: 'schlingentrainer-atomic-liegestuetz',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-atomic-liegestuetz-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz mit den Füßen in den Schlaufen, Arme gestreckt, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="63.3" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="128.3" y1="126" x2="94.7" y2="131.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="94.7" y1="131.3" x2="63" y2="135.8" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="63" y1="135.8" x2="52" y2="135.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="168.3" y2="144.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="168.3" y1="144.6" x2="167.5" y2="166.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="167.5" y1="166.6" x2="172.5" y2="166.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="164.8,112.8 167,128.6 129.3,133.4 127.2,118.6" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="181.8" cy="119" r="9" fill="{figure}"/><line x1="128.3" y1="126" x2="94.6" y2="130.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="94.6" y1="130.7" x2="62.9" y2="135.2" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="62.9" y1="135.2" x2="51.9" y2="135.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.3" y1="126" x2="94.6" y2="130.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="94.6" y1="130.7" x2="62.9" y2="135.2" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="62.9" y1="135.2" x2="51.9" y2="135.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="167.4" y2="144.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="167.4" y1="144.7" x2="167.4" y2="166.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="167.4" y1="166.7" x2="172.4" y2="166.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="167.4" y2="144.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="167.4" y1="144.7" x2="167.4" y2="166.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="167.4" y1="166.7" x2="172.4" y2="166.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="68.3" y1="10" x2="62.9" y2="135.2" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="62.9" cy="135.2" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-ausfallschritt': {
    media: {
      exercise_id: 'schlingentrainer-ausfallschritt',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-ausfallschritt-start.svg',
          alt_de:
            'Ausgangsposition: Rücken zum Anker, auf dem vorderen Bein stehen, der hintere Fuß liegt auf Kniehöhe in der Schlaufe.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="78.3" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="141.3" y1="99.5" x2="142.5" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="142.5" y1="133.5" x2="141.9" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="141.9" y1="165.5" x2="152.9" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="141.3" y1="62.5" x2="143.8" y2="86.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="143.8" y1="86.4" x2="154.1" y2="105.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="154.1" y1="105.8" x2="156.5" y2="110.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="133.3,61.5 149.3,61.5 148.8,99.5 133.8,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="141.3" cy="45.5" r="9" fill="{figure}"/><line x1="141.3" y1="99.5" x2="125.3" y2="129.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="125.3" y1="129.5" x2="94.6" y2="138.4" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="94.6" y1="138.4" x2="83.6" y2="138.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="141.3" y1="99.5" x2="125.3" y2="129.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="125.3" y1="129.5" x2="94.6" y2="138.4" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="94.6" y1="138.4" x2="83.6" y2="138.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="141.3" y1="62.5" x2="145.5" y2="86.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="145.5" y1="86.2" x2="156.5" y2="105.2" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="156.5" y1="105.2" x2="159" y2="109.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="141.3" y1="62.5" x2="145.5" y2="86.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="145.5" y1="86.2" x2="156.5" y2="105.2" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="156.5" y1="105.2" x2="159" y2="109.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="83.3" y1="10" x2="94.6" y2="138.4" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="94.6" cy="138.4" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-ausfallschritt-assistiert': {
    media: {
      exercise_id: 'schlingentrainer-ausfallschritt-assistiert',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-ausfallschritt-assistiert-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Gesicht zum Anker, Griffe vor der Brust, Füße hüftbreit.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="153.4" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="88.4" y1="99.5" x2="86.6" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="86.6" y1="133.5" x2="87.2" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="87.2" y1="165.5" x2="98.2" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="87.1" y1="62.5" x2="109.4" y2="71.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="109.4" y1="71.5" x2="131.2" y2="68.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="131.2" y1="68.5" x2="136.1" y2="67.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="79.1,61.8 95.1,61.3 95.9,99.3 80.9,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="86.5" cy="45.6" r="9" fill="{figure}"/><line x1="88.4" y1="99.5" x2="89.6" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="89.6" y1="133.5" x2="89" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="89" y1="165.5" x2="100" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="88.4" y1="99.5" x2="89.6" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="89.6" y1="133.5" x2="89" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="89" y1="165.5" x2="100" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="87.1" y1="62.5" x2="109.7" y2="70.8" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="109.7" y1="70.8" x2="131.3" y2="66.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="131.3" y1="66.9" x2="136.3" y2="66.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="87.1" y1="62.5" x2="109.7" y2="70.8" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="109.7" y1="70.8" x2="131.3" y2="66.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="131.3" y1="66.9" x2="136.3" y2="66.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.4" y1="10" x2="136.3" y2="66.1" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="136.3" cy="66.1" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-beinbeuger': {
    media: {
      exercise_id: 'schlingentrainer-beinbeuger',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-beinbeuger-start.svg',
          alt_de:
            'Ausgangsposition: Rückenlage, Fersen in den Schlaufen unter dem Anker, Beine gestreckt, Arme seitlich am Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="60.2" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="123.2" y1="159.5" x2="89.8" y2="153" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="89.8" y1="153" x2="58.5" y2="146.4" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="58.5" y1="146.4" x2="56.6" y2="135.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="160.2" y1="159.5" x2="136.2" y2="159.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="136.2" y1="159.9" x2="114.2" y2="159.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="114.2" y1="159.9" x2="109.2" y2="159.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="161.2,151.5 161.2,167.5 123.2,167 123.2,152" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="177.2" cy="158.5" r="9" fill="{figure}"/><line x1="123.2" y1="159.5" x2="89.9" y2="152.4" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="89.9" y1="152.4" x2="58.6" y2="145.8" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="58.6" y1="145.8" x2="56.7" y2="134.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="123.2" y1="159.5" x2="89.9" y2="152.4" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="89.9" y1="152.4" x2="58.6" y2="145.8" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="58.6" y1="145.8" x2="56.7" y2="134.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="160.2" y1="159.5" x2="136.2" y2="160.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="136.2" y1="160.3" x2="114.2" y2="160.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="114.2" y1="160.3" x2="109.2" y2="160.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="160.2" y1="159.5" x2="136.2" y2="160.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="136.2" y1="160.3" x2="114.2" y2="160.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="114.2" y1="160.3" x2="109.2" y2="160.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="65.2" y1="10" x2="58.6" y2="145.8" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="58.6" cy="145.8" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-bergsteiger': {
    media: {
      exercise_id: 'schlingentrainer-bergsteiger',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-bergsteiger-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz mit den Füßen in den Schlaufen, Hände unter den Schultern, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="63.3" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="128.3" y1="126" x2="94.7" y2="131.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="94.7" y1="131.3" x2="63" y2="135.8" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="63" y1="135.8" x2="52" y2="135.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="168.3" y2="144.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="168.3" y1="144.6" x2="167.5" y2="166.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="167.5" y1="166.6" x2="172.5" y2="166.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="164.8,112.8 167,128.6 129.3,133.4 127.2,118.6" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="181.8" cy="119" r="9" fill="{figure}"/><line x1="128.3" y1="126" x2="94.6" y2="130.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="94.6" y1="130.7" x2="62.9" y2="135.2" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="62.9" y1="135.2" x2="51.9" y2="135.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.3" y1="126" x2="94.6" y2="130.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="94.6" y1="130.7" x2="62.9" y2="135.2" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="62.9" y1="135.2" x2="51.9" y2="135.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="167.4" y2="144.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="167.4" y1="144.7" x2="167.4" y2="166.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="167.4" y1="166.7" x2="172.4" y2="166.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="167.4" y2="144.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="167.4" y1="144.7" x2="167.4" y2="166.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="167.4" y1="166.7" x2="172.4" y2="166.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="68.3" y1="10" x2="62.9" y2="135.2" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="62.9" cy="135.2" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-bizepscurl': {
    media: {
      exercise_id: 'schlingentrainer-bizepscurl',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-bizepscurl-start.svg',
          alt_de:
            'Ausgangsposition: Gesicht zum Anker, Griffe im Untergriff, Arme gestreckt auf Schulterhöhe, Körper gerade nach hinten gelehnt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="166.8" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="101.8" y1="113" x2="120.8" y2="141.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="120.8" y1="141.2" x2="139.6" y2="167.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.5" y2="81.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="104.5" y1="81.3" x2="116.8" y2="63" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="116.8" y1="63" x2="120.9" y2="60.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="73.4,86.5 86.5,77.3 107.9,108.7 95.6,117.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="72.2" cy="67.9" r="9" fill="{figure}"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="171.8" y1="10" x2="121.9" y2="59.1" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="121.9" cy="59.1" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-brustpresse': {
    media: {
      exercise_id: 'schlingentrainer-brustpresse',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-brustpresse-start.svg',
          alt_de:
            'Ausgangsposition: Rücken zum Anker, Griffe auf Brusthöhe, Arme gestreckt nach vorn, Körper gerade nach vorn gelehnt, Füße hinten.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="46.8" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="51.8" y1="10" x2="190" y2="70.9" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="190" cy="70.9" r="3.2" fill="{equip}"/><line x1="121.8" y1="108" x2="106.9" y2="138.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="106.9" y1="138.6" x2="90.9" y2="166.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="90.9" y1="166.3" x2="101.9" y2="166.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="139.2" y1="75.3" x2="163.1" y2="74.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="163.1" y1="74.1" x2="185.1" y2="72.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="185.1" y1="72.9" x2="190.1" y2="72.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="132.6,70.7 146.7,78.2 128.4,111.5 115.2,104.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="146.7" cy="60.1" r="9" fill="{figure}"/><line x1="121.8" y1="108" x2="105.8" y2="138" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="105.8" y1="138" x2="90.8" y2="166.3" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="90.8" y1="166.3" x2="101.8" y2="166.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="121.8" y1="108" x2="105.8" y2="138" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="105.8" y1="138" x2="90.8" y2="166.3" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="90.8" y1="166.3" x2="101.8" y2="166.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="139.2" y1="75.3" x2="163.1" y2="73.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="163.1" y1="73.2" x2="185" y2="71.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="185" y1="71.3" x2="190" y2="70.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="139.2" y1="75.3" x2="163.1" y2="73.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="163.1" y1="73.2" x2="185" y2="71.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="185" y1="71.3" x2="190" y2="70.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'schlingentrainer-einbeinige-kniebeuge': {
    media: {
      exercise_id: 'schlingentrainer-einbeinige-kniebeuge',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-einbeinige-kniebeuge-start.svg',
          alt_de:
            'Ausgangsposition: auf einem Bein stehen, Gesicht zum Anker, Griffe vor der Brust, das andere Bein leicht nach vorn gehoben.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="153.4" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="88.4" y1="99.5" x2="88.4" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="88.4" y1="133.5" x2="88.4" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="88.4" y1="165.5" x2="99.4" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="87.1" y1="62.5" x2="109.4" y2="71.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="109.4" y1="71.5" x2="131.2" y2="68.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="131.2" y1="68.5" x2="136.1" y2="67.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="79.1,61.8 95.1,61.2 95.9,99.2 80.9,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="86.5" cy="45.5" r="9" fill="{figure}"/><line x1="88.4" y1="99.5" x2="118.4" y2="115.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="118.4" y1="115.5" x2="146.7" y2="130.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="146.7" y1="130.5" x2="157.5" y2="128.6" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="88.4" y1="99.5" x2="118.4" y2="115.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="118.4" y1="115.5" x2="146.7" y2="130.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="146.7" y1="130.5" x2="157.5" y2="128.6" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="87.1" y1="62.5" x2="109.7" y2="70.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="109.7" y1="70.7" x2="131.3" y2="66.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="131.3" y1="66.9" x2="136.3" y2="66" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="87.1" y1="62.5" x2="109.7" y2="70.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="109.7" y1="70.7" x2="131.3" y2="66.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="131.3" y1="66.9" x2="136.3" y2="66" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.4" y1="10" x2="136.3" y2="66" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="136.3" cy="66" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-face-pull': {
    media: {
      exercise_id: 'schlingentrainer-face-pull',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-face-pull-start.svg',
          alt_de:
            'Ausgangsposition: Gesicht zum Anker, Griffe im Obergriff, Arme gestreckt, Körper gerade nach hinten gelehnt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="166.8" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="101.8" y1="113" x2="120.8" y2="141.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="120.8" y1="141.2" x2="139.6" y2="167.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.5" y2="81.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="104.5" y1="81.3" x2="116.8" y2="63" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="116.8" y1="63" x2="120.9" y2="60.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="73.4,86.5 86.5,77.3 107.9,108.7 95.6,117.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="72.2" cy="67.9" r="9" fill="{figure}"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="171.8" y1="10" x2="121.9" y2="59.1" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="121.9" cy="59.1" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-fallout': {
    media: {
      exercise_id: 'schlingentrainer-fallout',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-fallout-start.svg',
          alt_de:
            'Ausgangsposition: Rücken zum Anker, Arme gestreckt vor dem Körper, Körper leicht nach vorn gelehnt, Bauch fest.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="47.1" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="52.1" y1="10" x2="189.7" y2="66.5" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="189.7" cy="66.5" r="3.2" fill="{equip}"/><line x1="122.1" y1="108" x2="107.2" y2="138.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="107.2" y1="138.6" x2="91.2" y2="166.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="91.2" y1="166.3" x2="102.2" y2="166.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="139.5" y1="75.3" x2="163.2" y2="72" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="163.2" y1="72" x2="185" y2="68.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="185" y1="68.9" x2="190" y2="68.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="132.9,70.7 147,78.2 128.7,111.5 115.5,104.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="147" cy="60.1" r="9" fill="{figure}"/><line x1="122.1" y1="108" x2="106.1" y2="138" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="106.1" y1="138" x2="91.1" y2="166.3" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="91.1" y1="166.3" x2="102.1" y2="166.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="122.1" y1="108" x2="106.1" y2="138" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="106.1" y1="138" x2="91.1" y2="166.3" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="91.1" y1="166.3" x2="102.1" y2="166.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="139.5" y1="75.3" x2="163.1" y2="71.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="163.1" y1="71.2" x2="184.8" y2="67.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="184.8" y1="67.3" x2="189.7" y2="66.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="139.5" y1="75.3" x2="163.1" y2="71.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="163.1" y1="71.2" x2="184.8" y2="67.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="184.8" y1="67.3" x2="189.7" y2="66.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'schlingentrainer-fliegende': {
    media: {
      exercise_id: 'schlingentrainer-fliegende',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-fliegende-start.svg',
          alt_de:
            'Ausgangsposition: Rücken zum Anker, Griffe vor der Brust, Arme fast gestreckt, Körper gerade nach vorn gelehnt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="46.8" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="51.8" y1="10" x2="190" y2="70.9" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="190" cy="70.9" r="3.2" fill="{equip}"/><line x1="121.8" y1="108" x2="106.9" y2="138.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="106.9" y1="138.6" x2="90.9" y2="166.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="90.9" y1="166.3" x2="101.9" y2="166.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="139.2" y1="75.3" x2="163.1" y2="74.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="163.1" y1="74.1" x2="185.1" y2="72.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="185.1" y1="72.9" x2="190.1" y2="72.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="132.6,70.7 146.7,78.2 128.4,111.5 115.2,104.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="146.7" cy="60.1" r="9" fill="{figure}"/><line x1="121.8" y1="108" x2="105.8" y2="138" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="105.8" y1="138" x2="90.8" y2="166.3" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="90.8" y1="166.3" x2="101.8" y2="166.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="121.8" y1="108" x2="105.8" y2="138" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="105.8" y1="138" x2="90.8" y2="166.3" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="90.8" y1="166.3" x2="101.8" y2="166.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="139.2" y1="75.3" x2="163.1" y2="73.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="163.1" y1="73.2" x2="185" y2="71.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="185" y1="71.3" x2="190" y2="70.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="139.2" y1="75.3" x2="163.1" y2="73.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="163.1" y1="73.2" x2="185" y2="71.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="185" y1="71.3" x2="190" y2="70.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'schlingentrainer-hueftheben': {
    media: {
      exercise_id: 'schlingentrainer-hueftheben',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-hueftheben-start.svg',
          alt_de:
            'Ausgangsposition: Rückenlage, Fersen in den Schlaufen, Knie leicht gebeugt, Arme seitlich am Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="58.1" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="121.1" y1="159.5" x2="91.4" y2="143" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="91.4" y1="143" x2="60.6" y2="151.8" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="60.6" y1="151.8" x2="58.7" y2="141" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.1" y1="159.5" x2="134.1" y2="159.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="134.1" y1="159.9" x2="112.1" y2="159.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="112.1" y1="159.9" x2="107.1" y2="159.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="159.1,151.5 159.1,167.5 121.1,167 121.1,152" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="175.1" cy="158.5" r="9" fill="{figure}"/><line x1="121.1" y1="159.5" x2="91.7" y2="142.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="91.7" y1="142.5" x2="60.7" y2="150.8" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="60.7" y1="150.8" x2="58.8" y2="139.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="121.1" y1="159.5" x2="91.7" y2="142.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="91.7" y1="142.5" x2="60.7" y2="150.8" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="60.7" y1="150.8" x2="58.8" y2="139.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.1" y1="159.5" x2="134.1" y2="160.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="134.1" y1="160.3" x2="112.1" y2="160.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="112.1" y1="160.3" x2="107.1" y2="160.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="158.1" y1="159.5" x2="134.1" y2="160.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="134.1" y1="160.3" x2="112.1" y2="160.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="112.1" y1="160.3" x2="107.1" y2="160.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="63.1" y1="10" x2="60.7" y2="150.8" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="60.7" cy="150.8" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-knie-zur-brust': {
    media: {
      exercise_id: 'schlingentrainer-knie-zur-brust',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-knie-zur-brust-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz mit den Füßen in den Schlaufen, Arme gestreckt, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="63.3" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="128.3" y1="126" x2="94.7" y2="131.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="94.7" y1="131.3" x2="63" y2="135.8" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="63" y1="135.8" x2="52" y2="135.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="168.3" y2="144.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="168.3" y1="144.6" x2="167.5" y2="166.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="167.5" y1="166.6" x2="172.5" y2="166.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="164.8,112.8 167,128.6 129.3,133.4 127.2,118.6" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="181.8" cy="119" r="9" fill="{figure}"/><line x1="128.3" y1="126" x2="94.6" y2="130.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="94.6" y1="130.7" x2="62.9" y2="135.2" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="62.9" y1="135.2" x2="51.9" y2="135.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.3" y1="126" x2="94.6" y2="130.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="94.6" y1="130.7" x2="62.9" y2="135.2" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="62.9" y1="135.2" x2="51.9" y2="135.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="167.4" y2="144.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="167.4" y1="144.7" x2="167.4" y2="166.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="167.4" y1="166.7" x2="172.4" y2="166.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="167.4" y2="144.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="167.4" y1="144.7" x2="167.4" y2="166.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="167.4" y1="166.7" x2="172.4" y2="166.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="68.3" y1="10" x2="62.9" y2="135.2" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="62.9" cy="135.2" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-kniebeuge': {
    media: {
      exercise_id: 'schlingentrainer-kniebeuge',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-kniebeuge-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Gesicht zum Anker, Griffe vor der Brust, Füße schulterbreit, Gurte gespannt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="153.4" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="88.4" y1="99.5" x2="86.6" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="86.6" y1="133.5" x2="87.2" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="87.2" y1="165.5" x2="98.2" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="87.1" y1="62.5" x2="109.4" y2="71.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="109.4" y1="71.5" x2="131.2" y2="68.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="131.2" y1="68.5" x2="136.1" y2="67.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="79.1,61.8 95.1,61.3 95.9,99.3 80.9,99.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="86.5" cy="45.6" r="9" fill="{figure}"/><line x1="88.4" y1="99.5" x2="89.6" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="89.6" y1="133.5" x2="89" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="89" y1="165.5" x2="100" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="88.4" y1="99.5" x2="89.6" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="89.6" y1="133.5" x2="89" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="89" y1="165.5" x2="100" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="87.1" y1="62.5" x2="109.7" y2="70.8" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="109.7" y1="70.8" x2="131.3" y2="66.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="131.3" y1="66.9" x2="136.3" y2="66.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="87.1" y1="62.5" x2="109.7" y2="70.8" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="109.7" y1="70.8" x2="131.3" y2="66.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="131.3" y1="66.9" x2="136.3" y2="66.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.4" y1="10" x2="136.3" y2="66.1" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="136.3" cy="66.1" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-liegestuetz': {
    media: {
      exercise_id: 'schlingentrainer-liegestuetz',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-liegestuetz-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz, Hände unter den Schultern am Boden, Füße in den Schlaufen, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="63.3" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="128.3" y1="126" x2="94.7" y2="131.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="94.7" y1="131.3" x2="63" y2="135.8" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="63" y1="135.8" x2="52" y2="135.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="168.3" y2="144.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="168.3" y1="144.6" x2="167.5" y2="166.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="167.5" y1="166.6" x2="172.5" y2="166.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="164.8,112.8 167,128.6 129.3,133.4 127.2,118.6" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="181.8" cy="119" r="9" fill="{figure}"/><line x1="128.3" y1="126" x2="94.6" y2="130.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="94.6" y1="130.7" x2="62.9" y2="135.2" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="62.9" y1="135.2" x2="51.9" y2="135.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.3" y1="126" x2="94.6" y2="130.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="94.6" y1="130.7" x2="62.9" y2="135.2" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="62.9" y1="135.2" x2="51.9" y2="135.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="167.4" y2="144.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="167.4" y1="144.7" x2="167.4" y2="166.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="167.4" y1="166.7" x2="172.4" y2="166.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="167.4" y2="144.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="167.4" y1="144.7" x2="167.4" y2="166.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="167.4" y1="166.7" x2="172.4" y2="166.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="68.3" y1="10" x2="62.9" y2="135.2" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="62.9" cy="135.2" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-pike': {
    media: {
      exercise_id: 'schlingentrainer-pike',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-pike-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz mit den Füßen in den Schlaufen, Schultern über den Händen, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="63.3" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="128.3" y1="126" x2="94.7" y2="131.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="94.7" y1="131.3" x2="63" y2="135.8" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="63" y1="135.8" x2="52" y2="135.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="168.3" y2="144.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="168.3" y1="144.6" x2="167.5" y2="166.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="167.5" y1="166.6" x2="172.5" y2="166.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="164.8,112.8 167,128.6 129.3,133.4 127.2,118.6" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="181.8" cy="119" r="9" fill="{figure}"/><line x1="128.3" y1="126" x2="94.6" y2="130.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="94.6" y1="130.7" x2="62.9" y2="135.2" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="62.9" y1="135.2" x2="51.9" y2="135.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.3" y1="126" x2="94.6" y2="130.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="94.6" y1="130.7" x2="62.9" y2="135.2" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="62.9" y1="135.2" x2="51.9" y2="135.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="167.4" y2="144.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="167.4" y1="144.7" x2="167.4" y2="166.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="167.4" y1="166.7" x2="172.4" y2="166.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="164.9" y1="120.9" x2="167.4" y2="144.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="167.4" y1="144.7" x2="167.4" y2="166.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="167.4" y1="166.7" x2="172.4" y2="166.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="68.3" y1="10" x2="62.9" y2="135.2" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="62.9" cy="135.2" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-rudern': {
    media: {
      exercise_id: 'schlingentrainer-rudern',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-rudern-start.svg',
          alt_de:
            'Ausgangsposition: Gesicht zum Anker, Griffe in beiden Händen, Arme gestreckt, Körper gerade nach hinten gelehnt, Fersen am Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="166.8" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="101.8" y1="113" x2="120.8" y2="141.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="120.8" y1="141.2" x2="139.6" y2="167.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.5" y2="81.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="104.5" y1="81.3" x2="116.8" y2="63" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="116.8" y1="63" x2="120.9" y2="60.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="73.4,86.5 86.5,77.3 107.9,108.7 95.6,117.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="72.2" cy="67.9" r="9" fill="{figure}"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="171.8" y1="10" x2="121.9" y2="59.1" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="121.9" cy="59.1" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-rudern-einarmig': {
    media: {
      exercise_id: 'schlingentrainer-rudern-einarmig',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-rudern-einarmig-start.svg',
          alt_de:
            'Ausgangsposition: Gesicht zum Anker, ein Griff in einer Hand, Arm gestreckt, Körper gerade nach hinten gelehnt, freier Arm an der Seite.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="166.8" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="101.8" y1="113" x2="120.8" y2="141.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="120.8" y1="141.2" x2="139.6" y2="167.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="92.5" y2="103.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="92.5" y1="103.5" x2="100.1" y2="124.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="100.1" y1="124.1" x2="101.8" y2="128.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="73.4,86.5 86.5,77.3 107.9,108.7 95.6,117.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="72.2" cy="67.9" r="9" fill="{figure}"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="171.8" y1="10" x2="121.9" y2="59.1" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="121.9" cy="59.1" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-seitstuetz': {
    media: {
      exercise_id: 'schlingentrainer-seitstuetz',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-seitstuetz-start.svg',
          alt_de:
            'Ausgangsposition: Seitstütz von vorn, Ellbogen unter der Schulter, Füße übereinander in den Schlaufen, Körper gerade, oberer Arm nach oben gestreckt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="54.7" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><polygon points="161.7,110.3 165,134.1 126.9,135.4 124.6,119.6" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="179.2" cy="120" r="9" fill="{figure}"/><line x1="124.9" y1="121.5" x2="91.2" y2="125.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="91.2" y1="125.7" x2="59.4" y2="129.6" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="59.4" y1="129.6" x2="54.5" y2="130.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="124.9" y1="121.5" x2="91.2" y2="125.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="91.2" y1="125.7" x2="59.4" y2="129.6" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="59.4" y1="129.6" x2="54.5" y2="130.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126.6" y1="133.4" x2="92.8" y2="137.6" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="92.8" y1="137.6" x2="61.1" y2="141.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="61.1" y1="141.5" x2="56.2" y2="142.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126.6" y1="133.4" x2="92.8" y2="137.6" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="92.8" y1="137.6" x2="61.1" y2="141.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="61.1" y1="141.5" x2="56.2" y2="142.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="160.7" y1="110.4" x2="161.6" y2="86.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="161.6" y1="86.5" x2="161.6" y2="64.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="161.6" y1="64.5" x2="161.6" y2="59.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="160.7" y1="110.4" x2="161.6" y2="86.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="161.6" y1="86.5" x2="161.6" y2="64.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="161.6" y1="64.5" x2="161.6" y2="59.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.1" y1="134.2" x2="164.1" y2="158.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="164.1" y1="158.2" x2="167.2" y2="164" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="167.2" y1="164" x2="171" y2="167.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="164.1" y1="134.2" x2="164.1" y2="158.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="164.1" y1="158.2" x2="167.2" y2="164" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="167.2" y1="164" x2="171" y2="167.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="59.7" y1="10" x2="59.4" y2="129.6" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="59.4" cy="129.6" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-t-heben': {
    media: {
      exercise_id: 'schlingentrainer-t-heben',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-t-heben-start.svg',
          alt_de:
            'Ausgangsposition: Gesicht zum Anker, Arme gestreckt vor der Brust, Körper gerade nach hinten gelehnt, Fersen am Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="166.8" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="101.8" y1="113" x2="120.8" y2="141.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="120.8" y1="141.2" x2="139.6" y2="167.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.5" y2="81.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="104.5" y1="81.3" x2="116.8" y2="63" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="116.8" y1="63" x2="120.9" y2="60.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="73.4,86.5 86.5,77.3 107.9,108.7 95.6,117.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="72.2" cy="67.9" r="9" fill="{figure}"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="171.8" y1="10" x2="121.9" y2="59.1" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="121.9" cy="59.1" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-trizepsstrecken': {
    media: {
      exercise_id: 'schlingentrainer-trizepsstrecken',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-trizepsstrecken-start.svg',
          alt_de:
            'Ausgangsposition: Rücken zum Anker, Arme gestreckt schräg nach vorn oben, Körper gerade nach vorn gelehnt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="48.2" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="53.2" y1="10" x2="188.5" y2="57.9" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="188.5" cy="57.9" r="3.2" fill="{equip}"/><line x1="123.2" y1="108" x2="108.3" y2="138.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="108.3" y1="138.6" x2="92.3" y2="166.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="92.3" y1="166.3" x2="103.3" y2="166.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="140.6" y1="75.3" x2="163.4" y2="67.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="163.4" y1="67.9" x2="184.3" y2="61.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="184.3" y1="61.1" x2="189.1" y2="59.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="134,70.7 148.1,78.2 129.8,111.5 116.6,104.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="148.1" cy="60.1" r="9" fill="{figure}"/><line x1="123.2" y1="108" x2="107.2" y2="138" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="107.2" y1="138" x2="92.2" y2="166.3" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="92.2" y1="166.3" x2="103.2" y2="166.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="123.2" y1="108" x2="107.2" y2="138" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="107.2" y1="138" x2="92.2" y2="166.3" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="92.2" y1="166.3" x2="103.2" y2="166.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="140.6" y1="75.3" x2="163.1" y2="67.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="163.1" y1="67.1" x2="183.8" y2="59.6" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="183.8" y1="59.6" x2="188.5" y2="57.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="140.6" y1="75.3" x2="163.1" y2="67.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="163.1" y1="67.1" x2="183.8" y2="59.6" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="183.8" y1="59.6" x2="188.5" y2="57.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'schlingentrainer-unterarmstuetz': {
    media: {
      exercise_id: 'schlingentrainer-unterarmstuetz',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-unterarmstuetz-start.svg',
          alt_de:
            'Ausgangsposition: Unterarmstütz, Ellbogen unter den Schultern, Füße in den Schlaufen, Körper vom Kopf bis zu den Fersen gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="59.1" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="126.1" y1="143.3" x2="92.1" y2="145.1" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="92.1" y1="145.1" x2="60.1" y2="146.2" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="60.1" y1="146.2" x2="49.1" y2="146.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="163.1" y1="142" x2="163.9" y2="166" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="163.9" y1="166" x2="185.9" y2="165.2" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="185.9" y1="165.2" x2="190.9" y2="165.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="163.8,134 164.3,150 126.3,150.8 125.8,135.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="180" cy="141.4" r="9" fill="{figure}"/><line x1="126.1" y1="143.3" x2="92.1" y2="144.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="92.1" y1="144.5" x2="60.1" y2="145.6" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="60.1" y1="145.6" x2="49.1" y2="145.6" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126.1" y1="143.3" x2="92.1" y2="144.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="92.1" y1="144.5" x2="60.1" y2="145.6" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="60.1" y1="145.6" x2="49.1" y2="145.6" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="163.1" y1="142" x2="163.1" y2="166" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="163.1" y1="166" x2="185.1" y2="166" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="185.1" y1="166" x2="190.1" y2="166" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="163.1" y1="142" x2="163.1" y2="166" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="163.1" y1="166" x2="185.1" y2="166" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="185.1" y1="166" x2="190.1" y2="166" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="64.1" y1="10" x2="60.1" y2="145.6" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="60.1" cy="145.6" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schlingentrainer-y-heben': {
    media: {
      exercise_id: 'schlingentrainer-y-heben',
      images: [
        {
          kind: 'start_position',
          file: 'schlingentrainer-y-heben-start.svg',
          alt_de:
            'Ausgangsposition: Gesicht zum Anker, Griffe vor der Brust, Arme gestreckt, Körper leicht nach hinten gelehnt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="166.8" y="6" width="10" height="4" rx="1.5" fill="{furnitureLine}"/><line x1="101.8" y1="113" x2="120.8" y2="141.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="120.8" y1="141.2" x2="139.6" y2="167.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.5" y2="81.3" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="104.5" y1="81.3" x2="116.8" y2="63" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="116.8" y1="63" x2="120.9" y2="60.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="73.4,86.5 86.5,77.3 107.9,108.7 95.6,117.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="72.2" cy="67.9" r="9" fill="{figure}"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="101.8" y1="113" x2="121.3" y2="140.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="121.3" y1="140.9" x2="139.6" y2="167.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="139.6" y1="167.1" x2="150.6" y2="167.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="80.5" y1="82.7" x2="104.3" y2="79.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="104.3" y1="79.4" x2="117.8" y2="62" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="117.8" y1="62" x2="121.9" y2="59.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="171.8" y1="10" x2="121.9" y2="59.1" stroke="{equip}" stroke-width="2.2" stroke-linecap="round"/><circle cx="121.9" cy="59.1" r="3.2" fill="{equip}"/></svg>',
    },
  },
  'schraegbankdruecken-kurzhantel': {
    media: {
      exercise_id: 'schraegbankdruecken-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'schraegbankdruecken-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: auf der Schrägbank (etwa 30 Grad) liegen, Füße am Boden, je eine Kurzhantel seitlich der oberen Brust.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="114.7" y="140" width="18" height="30" fill="{furniture}"/><line x1="112.7" y1="137" x2="140.7" y2="137" stroke="{furnitureLine}" stroke-width="7" stroke-linecap="round"/><line x1="118.7" y1="140" x2="74.7" y2="114.6" stroke="{furnitureLine}" stroke-width="7" stroke-linecap="round"/><circle cx="97.7" cy="93" r="6" fill="{equip}"/><circle cx="97.7" cy="93" r="2" fill="{equipSoft}"/><line x1="122.7" y1="126" x2="155.6" y2="134.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="155.6" y1="134.5" x2="156.7" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="156.7" y1="166.5" x2="167.7" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="90.6" y1="107.5" x2="114.6" y2="108" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="114.6" y1="108" x2="97.7" y2="94" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="97.7" y1="94" x2="97.7" y2="89" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="85.8,113.9 93.8,100.1 126.4,119.5 118.9,132.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="76.6" cy="98" r="9" fill="{figure}"/><line x1="122.7" y1="126" x2="155.6" y2="134.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="155.6" y1="134.7" x2="158.7" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="158.7" y1="166.5" x2="169.7" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="122.7" y1="126" x2="155.6" y2="134.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="155.6" y1="134.7" x2="158.7" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="158.7" y1="166.5" x2="169.7" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="90.6" y1="107.5" x2="114.6" y2="109.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="114.6" y1="109.2" x2="98.7" y2="94" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="98.7" y1="94" x2="98.7" y2="89" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="90.6" y1="107.5" x2="114.6" y2="109.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="114.6" y1="109.2" x2="98.7" y2="94" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="98.7" y1="94" x2="98.7" y2="89" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="98.7" cy="93" r="6" fill="{equip}"/><circle cx="98.7" cy="93" r="2" fill="{equipSoft}"/></svg>',
    },
  },
  'schulter-rueckseite-dehnen': {
    media: {
      exercise_id: 'schulter-rueckseite-dehnen',
      images: [
        {
          kind: 'start_position',
          file: 'schulter-rueckseite-dehnen-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – aufrecht stehen, ein gestreckter Arm quer vor der Brust, die andere Hand oberhalb des Ellbogens.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="101.4,61.5 125.4,61.5 121.4,99.5 105.4,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="113.4" cy="45.5" r="9" fill="{figure}"/><line x1="107.4" y1="99.5" x2="108.6" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="108.6" y1="133.5" x2="108.6" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="108.6" y1="165.5" x2="104" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="107.4" y1="99.5" x2="108.6" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="108.6" y1="133.5" x2="108.6" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="108.6" y1="165.5" x2="104" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="119.4" y1="99.5" x2="118.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="118.2" y1="133.5" x2="118.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="118.2" y1="165.5" x2="122.9" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="119.4" y1="99.5" x2="118.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="118.2" y1="133.5" x2="118.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="118.2" y1="165.5" x2="122.9" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="101.4" y1="62.5" x2="125.2" y2="65.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="125.2" y1="65.9" x2="147" y2="68.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="147" y1="68.9" x2="151.9" y2="69.6" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="101.4" y1="62.5" x2="125.2" y2="65.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="125.2" y1="65.9" x2="147" y2="68.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="147" y1="68.9" x2="151.9" y2="69.6" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="125.4" y1="62.5" x2="113.4" y2="83.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="113.4" y1="83.3" x2="92.8" y2="75.8" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="92.8" y1="75.8" x2="88.1" y2="74.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="125.4" y1="62.5" x2="113.4" y2="83.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="113.4" y1="83.3" x2="92.8" y2="75.8" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="92.8" y1="75.8" x2="88.1" y2="74.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'schulterblatt-kreisen': {
    media: {
      exercise_id: 'schulterblatt-kreisen',
      images: [
        {
          kind: 'start_position',
          file: 'schulterblatt-kreisen-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – aufrecht stehen, Arme hängen locker, Schultern entspannt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="108,61.5 132,61.5 128,99.5 112,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="45.5" r="9" fill="{figure}"/><line x1="114" y1="99.5" x2="115.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="115.2" y1="133.5" x2="115.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="115.2" y1="165.5" x2="110.5" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="99.5" x2="115.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="115.2" y1="133.5" x2="115.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="115.2" y1="165.5" x2="110.5" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.8" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="124.8" y1="133.5" x2="124.8" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="124.8" y1="165.5" x2="129.5" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.8" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="124.8" y1="133.5" x2="124.8" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="124.8" y1="165.5" x2="129.5" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="62.5" x2="105.5" y2="86.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="105.5" y1="86.4" x2="104.3" y2="108.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="104.3" y1="108.4" x2="104.1" y2="113.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="62.5" x2="105.5" y2="86.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="105.5" y1="86.4" x2="104.3" y2="108.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="104.3" y1="108.4" x2="104.1" y2="113.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="62.5" x2="134.5" y2="86.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="134.5" y1="86.4" x2="135.7" y2="108.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="135.7" y1="108.4" x2="135.9" y2="113.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="62.5" x2="134.5" y2="86.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="134.5" y1="86.4" x2="135.7" y2="108.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="135.7" y1="108.4" x2="135.9" y2="113.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'schulterdruecken-band': {
    media: {
      exercise_id: 'schulterdruecken-band',
      images: [
        {
          kind: 'start_position',
          file: 'schulterdruecken-band-start.svg',
          alt_de:
            'Ausgangsposition: hüftbreit auf dem Widerstandsband stehen, die Enden auf Schulterhöhe halten.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="118.1" y1="99.5" x2="116.3" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="116.3" y1="133.5" x2="116.8" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="116.8" y1="165.5" x2="127.8" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="123.1" y2="86" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="123.1" y1="86" x2="121.1" y2="64.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="121.1" y1="64.1" x2="120.7" y2="59.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="110.1,61.5 126.1,61.5 125.6,99.5 110.6,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="118.1" cy="45.5" r="9" fill="{figure}"/><line x1="118.1" y1="99.5" x2="119.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="119.2" y1="133.5" x2="118.7" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="118.7" y1="165.5" x2="129.7" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="99.5" x2="119.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="119.2" y1="133.5" x2="118.7" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="118.7" y1="165.5" x2="129.7" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="124.3" y2="85.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="124.3" y1="85.7" x2="123.5" y2="63.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="123.5" y1="63.7" x2="123.3" y2="58.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="124.3" y2="85.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="124.3" y1="85.7" x2="123.5" y2="63.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="123.5" y1="63.7" x2="123.3" y2="58.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="123.7" y1="167.5" x2="123.5" y2="63.7" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
  },
  'schulterdruecken-kurzhantel': {
    media: {
      exercise_id: 'schulterdruecken-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'schulterdruecken-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, je eine Kurzhantel auf Schulterhöhe, Ellbogen darunter.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="118.1" y1="99.5" x2="116.3" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="116.3" y1="133.5" x2="116.8" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="116.8" y1="165.5" x2="127.8" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="123.1" y2="86" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="123.1" y1="86" x2="121.1" y2="64.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="121.1" y1="64.1" x2="120.7" y2="59.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="110.1,61.5 126.1,61.5 125.6,99.5 110.6,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="118.1" cy="45.5" r="9" fill="{figure}"/><line x1="118.1" y1="99.5" x2="119.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="119.2" y1="133.5" x2="118.7" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="118.7" y1="165.5" x2="129.7" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="99.5" x2="119.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="119.2" y1="133.5" x2="118.7" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="118.7" y1="165.5" x2="129.7" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="124.3" y2="85.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="124.3" y1="85.7" x2="123.5" y2="63.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="123.5" y1="63.7" x2="123.3" y2="58.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="124.3" y2="85.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="124.3" y1="85.7" x2="123.5" y2="63.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="123.5" y1="63.7" x2="123.3" y2="58.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="123.5" cy="60.7" r="6" fill="{equip}"/><circle cx="123.5" cy="60.7" r="2" fill="{equipSoft}"/></svg>',
    },
  },
  'schulterdruecken-langhantel': {
    media: {
      exercise_id: 'schulterdruecken-langhantel',
      images: [
        {
          kind: 'start_position',
          file: 'schulterdruecken-langhantel-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Langhantel liegt auf den vorderen Schultern, schulterbreiter Griff, Füße hüftbreit; dahinter das Rack.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="91.2" y1="170" x2="91.2" y2="20" stroke="{furnitureLine}" stroke-width="5" stroke-linecap="round"/><polyline points="85.2,66 97.2,66 97.2,61" fill="none" stroke="{furnitureLine}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><line x1="135.2" y1="99.5" x2="133.4" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="133.4" y1="133.5" x2="134" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="134" y1="165.5" x2="145" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="135.2" y1="62.5" x2="142.2" y2="85.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="142.2" y1="85.5" x2="139.1" y2="63.7" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="139.1" y1="63.7" x2="138.3" y2="58.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="127.2,61.5 143.2,61.5 142.7,99.5 127.7,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="135.2" cy="45.5" r="9" fill="{figure}"/><line x1="135.2" y1="99.5" x2="136.4" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="136.4" y1="133.5" x2="135.8" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="135.8" y1="165.5" x2="146.8" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="135.2" y1="99.5" x2="136.4" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="136.4" y1="133.5" x2="135.8" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="135.8" y1="165.5" x2="146.8" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="135.2" y1="62.5" x2="143.4" y2="85.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="143.4" y1="85.1" x2="139.6" y2="63.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="139.6" y1="63.4" x2="138.7" y2="58.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="135.2" y1="62.5" x2="143.4" y2="85.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="143.4" y1="85.1" x2="139.6" y2="63.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="139.6" y1="63.4" x2="138.7" y2="58.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="140.6" cy="60.4" r="14" fill="none" stroke="{equip}" stroke-width="3.5"/><circle cx="140.6" cy="60.4" r="3" fill="{equip}"/></svg>',
    },
  },
  'seitheben-band': {
    media: {
      exercise_id: 'seitheben-band',
      images: [
        {
          kind: 'start_position',
          file: 'seitheben-band-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – mit beiden Füßen auf der Mitte des Widerstandsbands stehen, die Enden seitlich neben dem Körper greifen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="108,61.5 132,61.5 128,99.5 112,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="45.5" r="9" fill="{figure}"/><line x1="114" y1="99.5" x2="114" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="114" y1="133.5" x2="114" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="114" y1="165.5" x2="109.3" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="99.5" x2="114" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="114" y1="133.5" x2="114" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="114" y1="165.5" x2="109.3" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="99.5" x2="126" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="126" y1="133.5" x2="126" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="126" y1="165.5" x2="130.7" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="99.5" x2="126" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="126" y1="133.5" x2="126" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="126" y1="165.5" x2="130.7" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="62.5" x2="103.8" y2="86.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="103.8" y1="86.1" x2="102.3" y2="108.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="102.3" y1="108.1" x2="101.9" y2="113.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="62.5" x2="103.8" y2="86.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="103.8" y1="86.1" x2="102.3" y2="108.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="102.3" y1="108.1" x2="101.9" y2="113.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="62.5" x2="136.2" y2="86.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="136.2" y1="86.1" x2="137.7" y2="108.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="137.7" y1="108.1" x2="138.1" y2="113.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="62.5" x2="136.2" y2="86.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="136.2" y1="86.1" x2="137.7" y2="108.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="137.7" y1="108.1" x2="138.1" y2="113.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="117" y1="165.5" x2="102.3" y2="108.1" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/><line x1="123" y1="165.5" x2="137.7" y2="108.1" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
  },
  'seitheben-kurzhantel': {
    media: {
      exercise_id: 'seitheben-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'seitheben-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – aufrecht stehen, je eine leichte Kurzhantel seitlich neben dem Körper, Ellbogen leicht gebeugt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="108,61.5 132,61.5 128,99.5 112,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="45.5" r="9" fill="{figure}"/><line x1="114" y1="99.5" x2="114" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="114" y1="133.5" x2="114" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="114" y1="165.5" x2="109.3" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="99.5" x2="114" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="114" y1="133.5" x2="114" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="114" y1="165.5" x2="109.3" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="99.5" x2="126" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="126" y1="133.5" x2="126" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="126" y1="165.5" x2="130.7" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="99.5" x2="126" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="126" y1="133.5" x2="126" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="126" y1="165.5" x2="130.7" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="62.5" x2="103.8" y2="86.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="103.8" y1="86.1" x2="102.3" y2="108.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="102.3" y1="108.1" x2="101.9" y2="113.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="62.5" x2="103.8" y2="86.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="103.8" y1="86.1" x2="102.3" y2="108.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="102.3" y1="108.1" x2="101.9" y2="113.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="62.5" x2="136.2" y2="86.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="136.2" y1="86.1" x2="137.7" y2="108.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="137.7" y1="108.1" x2="138.1" y2="113.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="62.5" x2="136.2" y2="86.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="136.2" y1="86.1" x2="137.7" y2="108.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="137.7" y1="108.1" x2="138.1" y2="113.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="102.3" cy="109.1" r="6" fill="{equip}"/><circle cx="102.3" cy="109.1" r="2" fill="{equipSoft}"/><circle cx="137.7" cy="109.1" r="6" fill="{equip}"/><circle cx="137.7" cy="109.1" r="2" fill="{equipSoft}"/></svg>',
    },
  },
  'seitlicher-ausfallschritt': {
    media: {
      exercise_id: 'seitlicher-ausfallschritt',
      images: [
        {
          kind: 'start_position',
          file: 'seitlicher-ausfallschritt-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – breiter Stand, Füße deutlich weiter als schulterbreit, Arme locker neben dem Körper.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="108,65.9 132,65.9 128,103.9 112,103.9" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="49.9" r="9" fill="{figure}"/><line x1="114" y1="103.9" x2="101.3" y2="135.4" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="101.3" y1="135.4" x2="90.3" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="90.3" y1="165.5" x2="85.7" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="103.9" x2="101.3" y2="135.4" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="101.3" y1="135.4" x2="90.3" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="90.3" y1="165.5" x2="85.7" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="103.9" x2="138.7" y2="135.4" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="138.7" y1="135.4" x2="149.7" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="149.7" y1="165.5" x2="154.3" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="103.9" x2="138.7" y2="135.4" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="138.7" y1="135.4" x2="149.7" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="149.7" y1="165.5" x2="154.3" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="66.9" x2="103.8" y2="90.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="103.8" y1="90.5" x2="101.9" y2="112.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="101.9" y1="112.5" x2="101.5" y2="117.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="66.9" x2="103.8" y2="90.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="103.8" y1="90.5" x2="101.9" y2="112.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="101.9" y1="112.5" x2="101.5" y2="117.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="66.9" x2="136.2" y2="90.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="136.2" y1="90.5" x2="138.1" y2="112.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="138.1" y1="112.5" x2="138.5" y2="117.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="66.9" x2="136.2" y2="90.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="136.2" y1="90.5" x2="138.1" y2="112.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="138.1" y1="112.5" x2="138.5" y2="117.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  seitstuetz: {
    media: {
      exercise_id: 'seitstuetz',
      images: [
        {
          kind: 'start_position',
          file: 'seitstuetz-start.svg',
          alt_de:
            'Ausgangsposition: Seitstütz von vorn – Ellbogen unter der Schulter, Beine gestreckt, Hüfte angehoben, Körper vom Kopf bis zu den Füßen gerade, oberer Arm nach oben gestreckt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="158.6,111 165.7,133.9 128.2,141.2 123.5,125.9" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="177.5" cy="117.8" r="9" fill="{figure}"/><line x1="124.1" y1="127.8" x2="91.5" y2="137.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="91.5" y1="137.8" x2="60.9" y2="147.1" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="60.9" y1="147.1" x2="56.3" y2="148.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="124.1" y1="127.8" x2="91.5" y2="137.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="91.5" y1="137.8" x2="60.9" y2="147.1" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="60.9" y1="147.1" x2="56.3" y2="148.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.6" y1="139.3" x2="95.1" y2="149.2" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="95.1" y1="149.2" x2="64.5" y2="158.6" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="64.5" y1="158.6" x2="59.8" y2="160.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="127.6" y1="139.3" x2="95.1" y2="149.2" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="95.1" y1="149.2" x2="64.5" y2="158.6" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="64.5" y1="158.6" x2="59.8" y2="160.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="157.7" y1="111.3" x2="158.5" y2="87.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="158.5" y1="87.3" x2="158.5" y2="65.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="158.5" y1="65.3" x2="158.5" y2="60.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="157.7" y1="111.3" x2="158.5" y2="87.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="158.5" y1="87.3" x2="158.5" y2="65.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="158.5" y1="65.3" x2="158.5" y2="60.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="164.7" y1="134.2" x2="164.7" y2="158.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="164.7" y1="158.2" x2="167.8" y2="164" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="167.8" y1="164" x2="171.6" y2="167.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="164.7" y1="134.2" x2="164.7" y2="158.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="164.7" y1="158.2" x2="167.8" y2="164" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="167.8" y1="164" x2="171.6" y2="167.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'seitstuetz-knie': {
    media: {
      exercise_id: 'seitstuetz-knie',
      images: [
        {
          kind: 'start_position',
          file: 'seitstuetz-knie-start.svg',
          alt_de:
            'Ausgangsposition: Seitstütz auf den Knien von vorn – Ellbogen unter der Schulter, Knie gebeugt, Hüfte angehoben, Kopf, Hüfte und Knie in einer Linie.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="142.4,111 149.4,133.9 111.9,141.2 107.2,125.9" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="161.2" cy="117.8" r="9" fill="{figure}"/><line x1="107.8" y1="127.8" x2="75.3" y2="137.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="75.3" y1="137.8" x2="75.3" y2="147.4" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="75.3" y1="147.4" x2="75.3" y2="152.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="107.8" y1="127.8" x2="75.3" y2="137.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="75.3" y1="137.8" x2="75.3" y2="147.4" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="75.3" y1="147.4" x2="75.3" y2="152.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="111.3" y1="139.3" x2="78.8" y2="149.2" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="78.8" y1="149.2" x2="78.8" y2="158.8" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="78.8" y1="158.8" x2="78.8" y2="163.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="111.3" y1="139.3" x2="78.8" y2="149.2" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="78.8" y1="149.2" x2="78.8" y2="158.8" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="78.8" y1="158.8" x2="78.8" y2="163.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="141.4" y1="111.3" x2="142.3" y2="87.3" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="142.3" y1="87.3" x2="142.3" y2="65.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="142.3" y1="65.3" x2="142.3" y2="60.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="141.4" y1="111.3" x2="142.3" y2="87.3" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="142.3" y1="87.3" x2="142.3" y2="65.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="142.3" y1="65.3" x2="142.3" y2="60.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="148.5" y1="134.2" x2="148.5" y2="158.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="148.5" y1="158.2" x2="151.6" y2="164" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="151.6" y1="164" x2="155.4" y2="167.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="148.5" y1="134.2" x2="148.5" y2="158.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="148.5" y1="158.2" x2="151.6" y2="164" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="151.6" y1="164" x2="155.4" y2="167.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'skapula-klimmzug': {
    media: {
      exercise_id: 'skapula-klimmzug',
      images: [
        {
          kind: 'start_position',
          file: 'skapula-klimmzug-start.svg',
          alt_de:
            'Ausgangsposition: gestreckter Hang an der Klimmzugstange, Arme gestreckt, Schultern noch locker, Füße über dem Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="123.7,6 123.7,6.5 137.7,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="128.5" y2="131.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="128.5" y1="131.7" x2="102.3" y2="150.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="102.3" y1="150.1" x2="100.4" y2="160.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132" y2="37.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="132" y1="37.1" x2="132.4" y2="15.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="132.4" y1="15.1" x2="132.6" y2="10.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122.7,60.5 138.7,59.6 140.2,97.6 125.2,98.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="129.8" cy="44.1" r="10.6" fill="{gap}"/><circle cx="129.8" cy="44.1" r="9" fill="{figure}"/><circle cx="137.7" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'split-kniebeuge': {
    media: {
      exercise_id: 'split-kniebeuge',
      images: [
        {
          kind: 'start_position',
          file: 'split-kniebeuge-start.svg',
          alt_de:
            'Ausgangsposition: große Schrittstellung, vorderer Fuß flach, hinterer Fuß auf dem Ballen, Oberkörper aufrecht.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="117.4" y1="106" x2="111" y2="139.4" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="111" y1="139.4" x2="87.4" y2="161" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="87.4" y1="161" x2="95.8" y2="168.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="117.4" y1="69" x2="115.3" y2="92.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="115.3" y1="92.9" x2="114.1" y2="114.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="114.1" y1="114.9" x2="113.9" y2="119.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="109.4,68 125.4,68 124.9,106 109.9,106" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="117.4" cy="52" r="9" fill="{figure}"/><line x1="117.4" y1="106" x2="132.8" y2="136.3" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="132.8" y1="136.3" x2="143.4" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="143.4" y1="166.5" x2="154.4" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.4" y1="106" x2="132.8" y2="136.3" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="132.8" y1="136.3" x2="143.4" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="143.4" y1="166.5" x2="154.4" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="117.4" y1="69" x2="119" y2="92.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="119" y1="92.9" x2="119.8" y2="114.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="119.8" y1="114.9" x2="120" y2="119.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.4" y1="69" x2="119" y2="92.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="119" y1="92.9" x2="119.8" y2="114.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="119.8" y1="114.9" x2="120" y2="119.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'step-down-stufe': {
    media: {
      exercise_id: 'step-down-stufe',
      images: [
        {
          kind: 'start_position',
          file: 'step-down-stufe-start.svg',
          alt_de:
            'Ausgangsposition: auf einem Bein an der Kante einer Stufe stehen, das andere Bein hängt frei vor der Kante, Hände an der Hüfte.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="86" y="148" width="48" height="22" rx="1.5" fill="{furniture}"/><line x1="126" y1="81.5" x2="126" y2="115.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="126" y1="115.5" x2="126" y2="147.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="126" y1="147.5" x2="137" y2="147.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="124.7" y1="44.5" x2="127.2" y2="68.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="127.2" y1="68.4" x2="137.6" y2="87.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="137.6" y1="87.8" x2="139.9" y2="92.2" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="116.7,43.8 132.7,43.2 133.5,81.2 118.5,81.8" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="124.1" cy="27.5" r="9" fill="{figure}"/><line x1="126" y1="81.5" x2="140.4" y2="112.3" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="140.4" y1="112.3" x2="140.4" y2="144.3" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="140.4" y1="144.3" x2="151.2" y2="146.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="81.5" x2="140.4" y2="112.3" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="140.4" y1="112.3" x2="140.4" y2="144.3" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="140.4" y1="144.3" x2="151.2" y2="146.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="124.7" y1="44.5" x2="128.9" y2="68.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="128.9" y1="68.2" x2="139.9" y2="87.2" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="139.9" y1="87.2" x2="142.4" y2="91.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="124.7" y1="44.5" x2="128.9" y2="68.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="128.9" y1="68.2" x2="139.9" y2="87.2" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="139.9" y1="87.2" x2="142.4" y2="91.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'step-jacks': {
    media: {
      exercise_id: 'step-jacks',
      images: [
        {
          kind: 'start_position',
          file: 'step-jacks-start.svg',
          alt_de:
            'Ausgangsposition: von vorn – aufrecht stehen, Füße zusammen, Arme seitlich am Körper.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polygon points="108,61.5 132,61.5 128,99.5 112,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="45.5" r="9" fill="{figure}"/><line x1="114" y1="99.5" x2="115.8" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="115.8" y1="133.5" x2="115.8" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="115.8" y1="165.5" x2="111.1" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="114" y1="99.5" x2="115.8" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="115.8" y1="133.5" x2="115.8" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="115.8" y1="165.5" x2="111.1" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="124.2" y1="133.5" x2="124.2" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="124.2" y1="165.5" x2="128.9" y2="167.2" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126" y1="99.5" x2="124.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="124.2" y1="133.5" x2="124.2" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="124.2" y1="165.5" x2="128.9" y2="167.2" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="108" y1="62.5" x2="105.5" y2="86.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="105.5" y1="86.4" x2="104.3" y2="108.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="104.3" y1="108.4" x2="104.1" y2="113.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="108" y1="62.5" x2="105.5" y2="86.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="105.5" y1="86.4" x2="104.3" y2="108.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="104.3" y1="108.4" x2="104.1" y2="113.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="132" y1="62.5" x2="134.5" y2="86.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="134.5" y1="86.4" x2="135.7" y2="108.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="135.7" y1="108.4" x2="135.9" y2="113.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132" y1="62.5" x2="134.5" y2="86.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="134.5" y1="86.4" x2="135.7" y2="108.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="135.7" y1="108.4" x2="135.9" y2="113.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'step-up-stufe': {
    media: {
      exercise_id: 'step-up-stufe',
      images: [
        {
          kind: 'start_position',
          file: 'step-up-stufe-start.svg',
          alt_de:
            'Ausgangsposition: vor der untersten Treppenstufe stehen, ein Fuß komplett auf der Stufe, eine Hand am Geländer.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="79" y="156" width="106" height="14" rx="1.5" fill="{furniture}"/><rect x="111" y="142" width="74" height="28" rx="1.5" fill="{furniture}"/><polyline points="81,170 81,88 183,62" fill="none" stroke="{furnitureLine}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="65" y1="103" x2="71.7" y2="136.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="71.7" y1="136.3" x2="61" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="61" y1="166.5" x2="72" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="66.3" y1="66" x2="64.2" y2="89.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="64.2" y1="89.9" x2="63" y2="111.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="63" y1="111.9" x2="62.8" y2="116.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="58.3,64.7 74.3,65.3 72.5,103.3 57.5,102.7" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="66.9" cy="49" r="9" fill="{figure}"/><line x1="65" y1="103" x2="93.5" y2="121.6" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="93.5" y1="121.6" x2="89" y2="153.3" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="89" y1="153.3" x2="100" y2="153.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="65" y1="103" x2="93.5" y2="121.6" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="93.5" y1="121.6" x2="89" y2="153.3" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="89" y1="153.3" x2="100" y2="153.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="66.3" y1="66" x2="73.2" y2="89" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="73.2" y1="89" x2="95" y2="86" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="95" y1="86" x2="99.9" y2="85.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="66.3" y1="66" x2="73.2" y2="89" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="73.2" y1="89" x2="95" y2="86" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="95" y1="86" x2="99.9" y2="85.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'stuetz-barren': {
    media: {
      exercise_id: 'stuetz-barren',
      images: [
        {
          kind: 'start_position',
          file: 'stuetz-barren-start.svg',
          alt_de:
            'Ausgangsposition: Stütz am Barren, Arme gestreckt, Hände neben der Hüfte, Schultern tief, Beine angewinkelt über dem Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="95.8" y1="170" x2="95.8" y2="84" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="147.8" y1="170" x2="147.8" y2="84" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="117.8" y1="74" x2="121.4" y2="107.8" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="121.4" y1="107.8" x2="92.4" y2="121.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="92.4" y1="121.3" x2="86.9" y2="130.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="116.6" y1="37" x2="118.3" y2="61" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="118.3" y1="61" x2="120.7" y2="82.8" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="120.7" y1="82.8" x2="120.7" y2="87.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="108.5,36.3 124.5,35.7 125.3,73.7 110.4,74.3" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="116" cy="20" r="9" fill="{figure}"/><line x1="117.8" y1="74" x2="123.8" y2="107.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="123.8" y1="107.5" x2="93.7" y2="118.4" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="93.7" y1="118.4" x2="88.2" y2="128" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="117.8" y1="74" x2="123.8" y2="107.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="123.8" y1="107.5" x2="93.7" y2="118.4" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="93.7" y1="118.4" x2="88.2" y2="128" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="116.6" y1="37" x2="118.8" y2="60.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="118.8" y1="60.9" x2="121.7" y2="82.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="121.7" y1="82.7" x2="121.7" y2="87.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="116.6" y1="37" x2="118.8" y2="60.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="118.8" y1="60.9" x2="121.7" y2="82.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="121.7" y1="82.7" x2="121.7" y2="87.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="89.8" y1="84" x2="153.8" y2="84" stroke="{equip}" stroke-width="4" stroke-linecap="round"/></svg>',
    },
  },
  'tisch-rudern': {
    media: {
      exercise_id: 'tisch-rudern',
      images: [
        {
          kind: 'start_position',
          file: 'tisch-rudern-start.svg',
          alt_de:
            'Ausgangsposition: rücklings unter einem stabilen Tisch liegen, Hände greifen die Tischkante über der Brust, Arme gestreckt, Knie gebeugt, Körper von Schultern bis Knie gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="192.4" y1="170" x2="192.4" y2="110" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round"/><line x1="116.4" y1="109" x2="196.4" y2="109" stroke="{furnitureLine}" stroke-width="6" stroke-linecap="round"/><line x1="86.4" y1="151" x2="56.6" y2="134.6" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="56.6" y1="134.6" x2="54.4" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="54.4" y1="166.5" x2="43.4" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="122.6" y1="158.7" x2="128.4" y2="135.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="128.4" y1="135.4" x2="123.4" y2="114" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="123.4" y1="114" x2="123.4" y2="109" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="125.2,151.1 121.9,166.7 84.8,158.3 87.9,143.7" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="139.5" cy="159.3" r="9" fill="{figure}"/><line x1="86.4" y1="151" x2="56.6" y2="134.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="56.6" y1="134.5" x2="56.4" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="56.4" y1="166.5" x2="45.4" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="86.4" y1="151" x2="56.6" y2="134.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="56.6" y1="134.5" x2="56.4" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="56.4" y1="166.5" x2="45.4" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="122.6" y1="158.7" x2="128.9" y2="135.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="128.9" y1="135.5" x2="124.4" y2="114" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="124.4" y1="114" x2="124.4" y2="109" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="122.6" y1="158.7" x2="128.9" y2="135.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="128.9" y1="135.5" x2="124.4" y2="114" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="124.4" y1="114" x2="124.4" y2="109" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'toter-hang': {
    media: {
      exercise_id: 'toter-hang',
      images: [
        {
          kind: 'start_position',
          file: 'toter-hang-start.svg',
          alt_de:
            'Ausgangsposition: gestreckter Hang an der Klimmzugstange, Hände schulterbreit, Arme gestreckt, Beine locker angewinkelt, Füße über dem Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><polyline points="123.7,6 123.7,6.5 137.7,12.5" fill="none" stroke="{furnitureLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="128.5" y2="131.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="128.5" y1="131.7" x2="102.3" y2="150.1" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="102.3" y1="150.1" x2="100.4" y2="160.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132" y2="37.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="132" y1="37.1" x2="132.4" y2="15.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="132.4" y1="15.1" x2="132.6" y2="10.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122.7,60.5 138.7,59.6 140.2,97.6 125.2,98.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="132.7" y1="98" x2="129.7" y2="131.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="129.7" y1="131.9" x2="102" y2="147.9" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="102" y1="147.9" x2="100.1" y2="158.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="130.7" y1="61.1" x2="132.4" y2="37.1" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="132.4" y1="37.1" x2="133.2" y2="15.1" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="133.2" y1="15.1" x2="133.4" y2="10.1" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="129.8" cy="44.1" r="10.6" fill="{gap}"/><circle cx="129.8" cy="44.1" r="9" fill="{figure}"/><circle cx="137.7" cy="12.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'trizeps-dehnen': {
    media: {
      exercise_id: 'trizeps-dehnen',
      images: [
        {
          kind: 'start_position',
          file: 'trizeps-dehnen-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, ein Arm über dem Kopf gebeugt, die Hand liegt zwischen den Schulterblättern, die andere Hand am Ellbogen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="124.8" y1="99.5" x2="123" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="123" y1="133.5" x2="123.6" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="123.6" y1="165.5" x2="134.6" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="124.8" y1="62.5" x2="129" y2="38.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="129" y1="38.9" x2="108.3" y2="31.4" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="108.3" y1="31.4" x2="103.6" y2="29.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="116.8,61.5 132.8,61.5 132.3,99.5 117.3,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="124.8" y1="99.5" x2="126" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="126" y1="133.5" x2="125.4" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="125.4" y1="165.5" x2="136.4" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="124.8" y1="99.5" x2="126" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="126" y1="133.5" x2="125.4" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="125.4" y1="165.5" x2="136.4" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="124.8" y1="62.5" x2="120.6" y2="38.9" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="120.6" y1="38.9" x2="124.4" y2="60.6" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="124.4" y1="60.6" x2="125.3" y2="65.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="124.8" y1="62.5" x2="120.6" y2="38.9" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="120.6" y1="38.9" x2="124.4" y2="60.6" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="124.4" y1="60.6" x2="125.3" y2="65.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="124.8" cy="45.5" r="10.6" fill="{gap}"/><circle cx="124.8" cy="45.5" r="9" fill="{figure}"/></svg>',
    },
  },
  'trizeps-liegestuetz-eng': {
    media: {
      exercise_id: 'trizeps-liegestuetz-eng',
      images: [
        {
          kind: 'start_position',
          file: 'trizeps-liegestuetz-eng-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz von der Seite, Hände knapp schulterbreit unter der Brust, Arme gestreckt, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="123.3" y1="133.2" x2="91.6" y2="145.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="91.6" y1="145.3" x2="61.5" y2="156.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="61.5" y1="156.3" x2="64.3" y2="166.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="159.3" y2="144.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="159.3" y1="144.5" x2="158.9" y2="166.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="158.9" y1="166.5" x2="163.9" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="156.3,112.6 161.8,127.7 125.9,140.2 120.7,126.1" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="174.2" cy="115.1" r="9" fill="{figure}"/><line x1="123.3" y1="133.2" x2="91.4" y2="144.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="91.4" y1="144.8" x2="61.3" y2="155.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="61.3" y1="155.7" x2="64.1" y2="166.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="123.3" y1="133.2" x2="91.4" y2="144.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="91.4" y1="144.8" x2="61.3" y2="155.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="61.3" y1="155.7" x2="64.1" y2="166.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="158.1" y2="144.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="158.1" y1="144.5" x2="158.1" y2="166.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="158.1" y1="166.5" x2="163.1" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="158.1" y1="120.5" x2="158.1" y2="144.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="158.1" y1="144.5" x2="158.1" y2="166.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="158.1" y1="166.5" x2="163.1" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'trizepsdruecken-band': {
    media: {
      exercise_id: 'trizepsdruecken-band',
      images: [
        {
          kind: 'start_position',
          file: 'trizepsdruecken-band-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, Widerstandsband oben am Türanker, Ellbogen seitlich am Körper, Hände halten die Enden vor der Brust.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="138.5" y="20" width="7" height="150" fill="{furniture}"/><line x1="104.5" y1="99.5" x2="102.7" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="102.7" y1="133.5" x2="103.3" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="103.3" y1="165.5" x2="114.3" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="107.1" y1="62.6" x2="103.7" y2="86.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="103.7" y1="86.4" x2="123.2" y2="76.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="123.2" y1="76.1" x2="127.9" y2="74.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="99.2,61.1 115.1,62.2 112,100 97,99" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="108.3" cy="45.7" r="9" fill="{figure}"/><line x1="104.5" y1="99.5" x2="105.7" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="105.7" y1="133.5" x2="105.1" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="105.1" y1="165.5" x2="116.1" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="104.5" y1="99.5" x2="105.7" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="105.7" y1="133.5" x2="105.1" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="105.1" y1="165.5" x2="116.1" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="107.1" y1="62.6" x2="104.6" y2="86.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="104.6" y1="86.5" x2="123.6" y2="75.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="123.6" y1="75.5" x2="128.3" y2="73.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="107.1" y1="62.6" x2="104.6" y2="86.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="104.6" y1="86.5" x2="123.6" y2="75.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="123.6" y1="75.5" x2="128.3" y2="73.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="123.6" y1="75.5" x2="138.5" y2="22" stroke="{equip}" stroke-width="2.5" stroke-linecap="round"/></svg>',
    },
  },
  'trizepsdruecken-kabel': {
    media: {
      exercise_id: 'trizepsdruecken-kabel',
      images: [
        {
          kind: 'start_position',
          file: 'trizepsdruecken-kabel-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht vor dem Kabelzug stehen, Rolle ganz oben, Ellbogen seitlich am Körper, Hände halten das Seil vor der Brust.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="134" y="20" width="12" height="150" rx="2" fill="{furniture}"/><circle cx="140" cy="20" r="4" fill="{furnitureLine}"/><line x1="104" y1="99.5" x2="102.2" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="102.2" y1="133.5" x2="102.8" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="102.8" y1="165.5" x2="113.8" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="106.6" y1="62.6" x2="103.2" y2="86.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="103.2" y1="86.4" x2="122.7" y2="76.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="122.7" y1="76.1" x2="127.4" y2="74.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="98.7,61.1 114.6,62.2 111.5,100 96.5,99" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="107.8" cy="45.7" r="9" fill="{figure}"/><line x1="104" y1="99.5" x2="105.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="105.2" y1="133.5" x2="104.6" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="104.6" y1="165.5" x2="115.6" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="104" y1="99.5" x2="105.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="105.2" y1="133.5" x2="104.6" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="104.6" y1="165.5" x2="115.6" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="106.6" y1="62.6" x2="104.1" y2="86.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="104.1" y1="86.5" x2="123.1" y2="75.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="123.1" y1="75.5" x2="127.8" y2="73.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="106.6" y1="62.6" x2="104.1" y2="86.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="104.1" y1="86.5" x2="123.1" y2="75.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="123.1" y1="75.5" x2="127.8" y2="73.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="140" y1="20" x2="123.1" y2="75.5" stroke="{equip}" stroke-width="1.8" stroke-linecap="round"/><circle cx="123.1" cy="75.5" r="3.5" fill="{equip}"/></svg>',
    },
  },
  'trizepsstrecken-kurzhantel': {
    media: {
      exercise_id: 'trizepsstrecken-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'trizepsstrecken-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, eine Kurzhantel mit beiden Händen an einem Ende greifen und mit gestreckten Armen über den Kopf halten.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="118.1" y1="99.5" x2="116.3" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="116.3" y1="133.5" x2="116.8" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="116.8" y1="165.5" x2="127.8" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="116" y2="38.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="116" y1="38.6" x2="114.8" y2="16.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="114.8" y1="16.6" x2="114.8" y2="11.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="110.1,61.5 126.1,61.5 125.6,99.5 110.6,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><line x1="118.1" y1="99.5" x2="119.2" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="119.2" y1="133.5" x2="118.7" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="118.7" y1="165.5" x2="129.7" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="99.5" x2="119.2" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="119.2" y1="133.5" x2="118.7" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="118.7" y1="165.5" x2="129.7" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="116.4" y2="38.6" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="116.4" y1="38.6" x2="115.6" y2="16.6" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="115.6" y1="16.6" x2="115.6" y2="11.6" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="62.5" x2="116.4" y2="38.6" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="116.4" y1="38.6" x2="115.6" y2="16.6" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="115.6" y1="16.6" x2="115.6" y2="11.6" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><circle cx="118.1" cy="45.5" r="10.6" fill="{gap}"/><circle cx="118.1" cy="45.5" r="9" fill="{figure}"/><line x1="115.6" y1="15.6" x2="115.6" y2="29.6" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="110.1" y1="15.6" x2="121.1" y2="15.6" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="110.1" y1="29.6" x2="121.1" y2="29.6" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/></svg>',
    },
  },
  'tuerrahmen-rudern': {
    media: {
      exercise_id: 'tuerrahmen-rudern',
      images: [
        {
          kind: 'start_position',
          file: 'tuerrahmen-rudern-start.svg',
          alt_de:
            'Ausgangsposition: Füße dicht am Türrahmen, eine Hand greift den Rahmen auf Brusthöhe, Arm gestreckt, Körper gerade nach hinten gelehnt.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="144.5" y="20" width="8" height="150" fill="{furniture}"/><line x1="105" y1="102.3" x2="115.8" y2="134.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="115.8" y1="134.5" x2="114.5" y2="166.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="114.5" y1="166.5" x2="125.5" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.5" y1="65.9" x2="94.4" y2="89.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="94.4" y1="89.5" x2="92.4" y2="111.4" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="92.4" y1="111.4" x2="92" y2="116.4" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="90.5,66.3 106.2,63.5 112.3,101 97.6,103.6" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="96.5" cy="49" r="9" fill="{figure}"/><line x1="105" y1="102.3" x2="115.9" y2="134.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="115.9" y1="134.5" x2="116.5" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="116.5" y1="166.5" x2="127.5" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="105" y1="102.3" x2="115.9" y2="134.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="115.9" y1="134.5" x2="116.5" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="116.5" y1="166.5" x2="127.5" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.5" y1="65.9" x2="121.2" y2="73.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="121.2" y1="73.7" x2="142.3" y2="80" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="142.3" y1="80" x2="147.3" y2="80" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.5" y1="65.9" x2="121.2" y2="73.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="121.2" y1="73.7" x2="142.3" y2="80" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="142.3" y1="80" x2="147.3" y2="80" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'unterarm-dehnen': {
    media: {
      exercise_id: 'unterarm-dehnen',
      images: [
        {
          kind: 'start_position',
          file: 'unterarm-dehnen-start.svg',
          alt_de:
            'Ausgangsposition: aufrecht stehen, ein Arm gestreckt nach vorn, die Finger zeigen nach oben, die andere Hand fasst die Finger.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="98.4" y1="99.5" x2="96.6" y2="133.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="96.6" y1="133.5" x2="97.2" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="97.2" y1="165.5" x2="108.2" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.4" y2="63.8" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="122.4" y1="63.8" x2="144.4" y2="64.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="144.4" y1="64.5" x2="149.4" y2="64.7" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="90.4,61.5 106.4,61.5 105.9,99.5 90.9,99.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="98.4" cy="45.5" r="9" fill="{figure}"/><line x1="98.4" y1="99.5" x2="99.6" y2="133.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="99.6" y1="133.5" x2="99" y2="165.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="99" y1="165.5" x2="110" y2="165.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.4" y1="99.5" x2="99.6" y2="133.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="99.6" y1="133.5" x2="99" y2="165.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="99" y1="165.5" x2="110" y2="165.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.4" y2="62.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="122.4" y1="62.5" x2="144.4" y2="62.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="144.4" y1="62.5" x2="144.4" y2="57.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.4" y1="62.5" x2="122.4" y2="62.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="122.4" y1="62.5" x2="144.4" y2="62.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="144.4" y1="62.5" x2="144.4" y2="57.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  unterarmstuetz: {
    media: {
      exercise_id: 'unterarmstuetz',
      images: [
        {
          kind: 'start_position',
          file: 'unterarmstuetz-start.svg',
          alt_de:
            'Ausgangsposition: Unterarmstütz – Ellbogen unter den Schultern, Unterarme am Boden, auf den Fußspitzen, Körper vom Kopf bis zu den Fersen gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="121.3" y1="146.9" x2="87.7" y2="152.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="87.7" y1="152.2" x2="56.1" y2="156.6" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="56.1" y1="156.6" x2="58.9" y2="167.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="158" y1="141.7" x2="158.8" y2="165.7" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="158.8" y1="165.7" x2="180.8" y2="164.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="180.8" y1="164.9" x2="185.8" y2="164.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="157.8,133.6 160.1,149.5 122.4,154.3 120.3,139.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="174.9" cy="139.8" r="9" fill="{figure}"/><line x1="121.3" y1="146.9" x2="87.7" y2="151.6" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="87.7" y1="151.6" x2="56" y2="156" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="56" y1="156" x2="58.8" y2="166.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="121.3" y1="146.9" x2="87.7" y2="151.6" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="87.7" y1="151.6" x2="56" y2="156" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="56" y1="156" x2="58.8" y2="166.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="158" y1="141.7" x2="158" y2="165.7" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="158" y1="165.7" x2="180" y2="165.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="180" y1="165.7" x2="185" y2="165.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="158" y1="141.7" x2="158" y2="165.7" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="158" y1="165.7" x2="180" y2="165.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="180" y1="165.7" x2="185" y2="165.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'vorgebeugtes-rudern-kurzhantel': {
    media: {
      exercise_id: 'vorgebeugtes-rudern-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'vorgebeugtes-rudern-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: Oberkörper etwa 45 Grad vorgebeugt, Rücken gerade, Knie leicht gebeugt, je eine Kurzhantel an gestreckten Armen.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="132.7" y1="123.3" x2="118.7" y2="123.3" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="132.7" y1="117.8" x2="132.7" y2="128.8" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="118.7" y1="117.8" x2="118.7" y2="128.8" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="100.8" y1="101.5" x2="111.8" y2="133.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="111.8" y1="133.7" x2="108.5" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="108.5" y1="165.5" x2="119.5" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="126.9" y1="75.4" x2="126.1" y2="99.4" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="126.1" y1="99.4" x2="125.7" y2="121.3" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="125.7" y1="121.3" x2="125.7" y2="126.3" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="122,69 133.3,80.3 106.1,106.8 95.5,96.2" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="138" cy="62.5" r="9" fill="{figure}"/><line x1="100.8" y1="101.5" x2="113.5" y2="133.1" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="113.5" y1="133.1" x2="109" y2="164.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="109" y1="164.7" x2="120" y2="164.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="100.8" y1="101.5" x2="113.5" y2="133.1" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="113.5" y1="133.1" x2="109" y2="164.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="109" y1="164.7" x2="120" y2="164.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="126.9" y1="75.4" x2="126.9" y2="99.4" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="126.9" y1="99.4" x2="126.9" y2="121.4" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="126.9" y1="121.4" x2="126.9" y2="126.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="126.9" y1="75.4" x2="126.9" y2="99.4" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="126.9" y1="99.4" x2="126.9" y2="121.4" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="126.9" y1="121.4" x2="126.9" y2="126.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="133.9" y1="123.4" x2="119.9" y2="123.4" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="133.9" y1="117.9" x2="133.9" y2="128.9" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="119.9" y1="117.9" x2="119.9" y2="128.9" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/></svg>',
    },
  },
  'wadendehnung-wand': {
    media: {
      exercise_id: 'wadendehnung-wand',
      images: [
        {
          kind: 'start_position',
          file: 'wadendehnung-wand-start.svg',
          alt_de:
            'Ausgangsposition: mit beiden Händen an einer Wand abstützen, ein Bein vorn gebeugt, das hintere Bein gestreckt, die hintere Ferse am Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="163.4" y="20" width="8" height="150" fill="{furniture}"/><line x1="105.4" y1="106" x2="89.3" y2="135.9" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="89.3" y1="135.9" x2="73.1" y2="163.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="73.1" y1="163.5" x2="84.1" y2="163.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="71.2" x2="140.9" y2="63.8" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="140.9" y1="63.8" x2="161.8" y2="57" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="161.8" y1="57" x2="161.8" y2="52" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="110.9,67.6 125.9,73 112.5,108.6 98.4,103.4" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="123.4" cy="55.1" r="9" fill="{figure}"/><line x1="105.4" y1="106" x2="123.6" y2="134.7" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="123.6" y1="134.7" x2="127.4" y2="166.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="127.4" y1="166.5" x2="138.4" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="105.4" y1="106" x2="123.6" y2="134.7" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="123.6" y1="134.7" x2="127.4" y2="166.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="127.4" y1="166.5" x2="138.4" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="118.1" y1="71.2" x2="140.6" y2="63" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="140.6" y1="63" x2="161.3" y2="55.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="161.3" y1="55.5" x2="161.3" y2="50.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="118.1" y1="71.2" x2="140.6" y2="63" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="140.6" y1="63" x2="161.3" y2="55.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="161.3" y1="55.5" x2="161.3" y2="50.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'wadenheben-einbeinig': {
    media: {
      exercise_id: 'wadenheben-einbeinig',
      images: [
        {
          kind: 'start_position',
          file: 'wadenheben-einbeinig-start.svg',
          alt_de:
            'Ausgangsposition: auf einem Bein mit dem Fußballen auf einer Stufe stehen, das andere Bein angewinkelt, eine Hand an der Wand.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="116" y="158" width="46" height="12" rx="1.5" fill="{furniture}"/><rect x="164" y="20" width="8" height="150" fill="{furniture}"/><line x1="116" y1="87.5" x2="111.2" y2="121.2" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="111.2" y1="121.2" x2="80.3" y2="129.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="80.3" y1="129.5" x2="70.8" y2="135" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="116" y1="50.5" x2="120.1" y2="74.1" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="120.1" y1="74.1" x2="120.9" y2="96.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="120.9" y1="96.1" x2="121.1" y2="101.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="108,49.5 124,49.5 123.5,87.5 108.5,87.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="116" cy="33.5" r="9" fill="{figure}"/><line x1="116" y1="87.5" x2="116.6" y2="121.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="116.6" y1="121.5" x2="116.6" y2="153.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="116.6" y1="153.5" x2="127.6" y2="153.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="116" y1="87.5" x2="116.6" y2="121.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="116.6" y1="121.5" x2="116.6" y2="153.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="116.6" y1="153.5" x2="127.6" y2="153.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="116" y1="50.5" x2="139.4" y2="55.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="139.4" y1="55.5" x2="161.4" y2="54.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="161.4" y1="54.7" x2="162.3" y2="49.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="116" y1="50.5" x2="139.4" y2="55.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="139.4" y1="55.5" x2="161.4" y2="54.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="161.4" y1="54.7" x2="162.3" y2="49.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'wadenheben-gebeugtes-knie': {
    media: {
      exercise_id: 'wadenheben-gebeugtes-knie',
      images: [
        {
          kind: 'start_position',
          file: 'wadenheben-gebeugtes-knie-start.svg',
          alt_de:
            'Ausgangsposition: hüftbreit vor einer Wand stehen, eine Hand an der Wand, Knie leicht gebeugt, Fersen am Boden.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="145" y="20" width="8" height="150" fill="{furniture}"/><line x1="97" y1="102" x2="107.5" y2="134.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="107.5" y1="134.3" x2="100.3" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="100.3" y1="165.5" x2="111.3" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.3" y1="65" x2="102.5" y2="88.6" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="102.5" y1="88.6" x2="103.2" y2="110.6" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="103.2" y1="110.6" x2="103.4" y2="115.6" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="90.3,63.7 106.3,64.3 104.5,102.2 89.5,101.7" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="98.9" cy="48" r="9" fill="{figure}"/><line x1="97" y1="102" x2="108.6" y2="133.9" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="108.6" y1="133.9" x2="100.3" y2="164.8" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="100.3" y1="164.8" x2="111.3" y2="164.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="97" y1="102" x2="108.6" y2="133.9" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="108.6" y1="133.9" x2="100.3" y2="164.8" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="100.3" y1="164.8" x2="111.3" y2="164.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="98.3" y1="65" x2="121.9" y2="69.2" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="121.9" y1="69.2" x2="143.8" y2="67.3" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="143.8" y1="67.3" x2="144.7" y2="62.3" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="98.3" y1="65" x2="121.9" y2="69.2" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="121.9" y1="69.2" x2="143.8" y2="67.3" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="143.8" y1="67.3" x2="144.7" y2="62.3" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'wadenheben-koerpergewicht': {
    media: {
      exercise_id: 'wadenheben-koerpergewicht',
      images: [
        {
          kind: 'start_position',
          file: 'wadenheben-koerpergewicht-start.svg',
          alt_de:
            'Ausgangsposition: mit den Fußballen auf einer Stufe stehen, Fersen frei, eine Hand an der Wand vor dir.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="97.3" y="158" width="46" height="12" rx="1.5" fill="{furniture}"/><rect x="145.3" y="20" width="8" height="150" fill="{furniture}"/><line x1="97.3" y1="87.5" x2="95.5" y2="121.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="95.5" y1="121.5" x2="96" y2="153.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="96" y1="153.5" x2="107" y2="153.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="97.3" y1="50.5" x2="101.4" y2="74.2" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="101.4" y1="74.2" x2="102.2" y2="96.1" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="102.2" y1="96.1" x2="102.4" y2="101.1" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="89.3,49.5 105.3,49.5 104.8,87.5 89.8,87.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="97.3" cy="33.5" r="9" fill="{figure}"/><line x1="97.3" y1="87.5" x2="98.4" y2="121.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="98.4" y1="121.5" x2="97.9" y2="153.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="97.9" y1="153.5" x2="108.9" y2="153.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="97.3" y1="87.5" x2="98.4" y2="121.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="98.4" y1="121.5" x2="97.9" y2="153.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="97.9" y1="153.5" x2="108.9" y2="153.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="97.3" y1="50.5" x2="120.7" y2="55.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="120.7" y1="55.5" x2="142.7" y2="54.7" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="142.7" y1="54.7" x2="143.6" y2="49.8" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="97.3" y1="50.5" x2="120.7" y2="55.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="120.7" y1="55.5" x2="142.7" y2="54.7" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="142.7" y1="54.7" x2="143.6" y2="49.8" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'wadenheben-kurzhantel': {
    media: {
      exercise_id: 'wadenheben-kurzhantel',
      images: [
        {
          kind: 'start_position',
          file: 'wadenheben-kurzhantel-start.svg',
          alt_de:
            'Ausgangsposition: mit den Fußballen auf einer Stufe stehen, eine Kurzhantel seitlich in einer Hand, die andere Hand an der Wand.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="97.3" y="158" width="46" height="12" rx="1.5" fill="{furniture}"/><rect x="145.3" y="20" width="8" height="150" fill="{furniture}"/><line x1="97.3" y1="87.5" x2="95.5" y2="121.5" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="95.5" y1="121.5" x2="96" y2="153.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="96" y1="153.5" x2="107" y2="153.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="97.3" y1="50.5" x2="120.7" y2="55.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="120.7" y1="55.5" x2="142.7" y2="54.7" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="142.7" y1="54.7" x2="143.6" y2="49.8" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="89.3,49.5 105.3,49.5 104.8,87.5 89.8,87.5" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="97.3" cy="33.5" r="9" fill="{figure}"/><line x1="97.3" y1="87.5" x2="98.4" y2="121.5" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="98.4" y1="121.5" x2="97.9" y2="153.5" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="97.9" y1="153.5" x2="108.9" y2="153.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="97.3" y1="87.5" x2="98.4" y2="121.5" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="98.4" y1="121.5" x2="97.9" y2="153.5" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="97.9" y1="153.5" x2="108.9" y2="153.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="97.3" y1="50.5" x2="98.1" y2="74.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="98.1" y1="74.5" x2="98.5" y2="96.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="98.5" y1="96.5" x2="98.6" y2="101.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="97.3" y1="50.5" x2="98.1" y2="74.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="98.1" y1="74.5" x2="98.5" y2="96.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="98.5" y1="96.5" x2="98.6" y2="101.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="105.5" y1="97.5" x2="91.5" y2="97.5" stroke="{equip}" stroke-width="3" stroke-linecap="round"/><line x1="105.5" y1="92" x2="105.5" y2="103" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/><line x1="91.5" y1="92" x2="91.5" y2="103" stroke="{equip}" stroke-width="4.5" stroke-linecap="round"/></svg>',
    },
  },
  wandlaufen: {
    media: {
      exercise_id: 'wandlaufen',
      images: [
        {
          kind: 'start_position',
          file: 'wandlaufen-start.svg',
          alt_de:
            'Ausgangsposition: hoher Liegestütz mit den Fersen an einer Wand hinter dir, Arme gestreckt, Körper gerade.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><rect x="51.5" y="20" width="8" height="150" fill="{furniture}"/><line x1="128.5" y1="133.2" x2="96.8" y2="145.3" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="96.8" y1="145.3" x2="66.7" y2="156.3" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="66.7" y1="156.3" x2="69.6" y2="166.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="163.3" y1="120.5" x2="164.6" y2="144.5" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="164.6" y1="144.5" x2="164.2" y2="166.5" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="164.2" y1="166.5" x2="169.2" y2="166.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="161.5,112.6 167,127.7 131.1,140.2 126,126.1" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="179.5" cy="115.1" r="9" fill="{figure}"/><line x1="128.5" y1="133.2" x2="96.6" y2="144.8" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="96.6" y1="144.8" x2="66.5" y2="155.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="66.5" y1="155.7" x2="69.4" y2="166.4" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="128.5" y1="133.2" x2="96.6" y2="144.8" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="96.6" y1="144.8" x2="66.5" y2="155.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="66.5" y1="155.7" x2="69.4" y2="166.4" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="163.3" y1="120.5" x2="163.3" y2="144.5" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="163.3" y1="144.5" x2="163.3" y2="166.5" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="163.3" y1="166.5" x2="168.3" y2="166.5" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="163.3" y1="120.5" x2="163.3" y2="144.5" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="163.3" y1="144.5" x2="163.3" y2="166.5" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="163.3" y1="166.5" x2="168.3" y2="166.5" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
  'y-t-w-vorgebeugt': {
    media: {
      exercise_id: 'y-t-w-vorgebeugt',
      images: [
        {
          kind: 'start_position',
          file: 'y-t-w-vorgebeugt-start.svg',
          alt_de:
            'Ausgangsposition: hüftbreit stehen, Knie leicht gebeugt, Oberkörper mit geradem Rücken vorgeneigt, Arme hängen locker nach unten.',
          origin: 'own_work',
          license: { name: 'eigene Illustration Alpha5', attribution_de: null },
          source: { creator: 'Alpha5', obtained_on: '2026-10-21' },
          reviewed_by: null,
        },
      ],
    },
    templates: {
      start_position:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180"><line x1="8" y1="171" x2="232" y2="171" stroke="{ground}" stroke-width="2" stroke-linecap="round"/><line x1="95.6" y1="101.5" x2="106.6" y2="133.7" stroke="{figureFar}" stroke-width="11" stroke-linecap="round"/><line x1="106.6" y1="133.7" x2="103.3" y2="165.5" stroke="{figureFar}" stroke-width="9" stroke-linecap="round"/><line x1="103.3" y1="165.5" x2="114.3" y2="165.5" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.6" y1="83" x2="125.1" y2="106.9" stroke="{figureFar}" stroke-width="8" stroke-linecap="round"/><line x1="125.1" y1="106.9" x2="125.9" y2="128.9" stroke="{figureFar}" stroke-width="7" stroke-linecap="round"/><line x1="125.9" y1="128.9" x2="126" y2="133.9" stroke="{figureFar}" stroke-width="5.5" stroke-linecap="round"/><polygon points="124.5,75.6 132.5,89.5 99.3,108 91.8,95" fill="{figure}" stroke="{figure}" stroke-width="5" stroke-linejoin="round"/><circle cx="141.7" cy="73.5" r="9" fill="{figure}"/><line x1="95.6" y1="101.5" x2="108.3" y2="133.1" stroke="{gap}" stroke-width="14.2" stroke-linecap="round"/><line x1="108.3" y1="133.1" x2="103.9" y2="164.7" stroke="{gap}" stroke-width="12.2" stroke-linecap="round"/><line x1="103.9" y1="164.7" x2="114.9" y2="164.7" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="95.6" y1="101.5" x2="108.3" y2="133.1" stroke="{figure}" stroke-width="11" stroke-linecap="round"/><line x1="108.3" y1="133.1" x2="103.9" y2="164.7" stroke="{figure}" stroke-width="9" stroke-linecap="round"/><line x1="103.9" y1="164.7" x2="114.9" y2="164.7" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/><line x1="127.6" y1="83" x2="125.9" y2="107" stroke="{gap}" stroke-width="11.2" stroke-linecap="round"/><line x1="125.9" y1="107" x2="127.5" y2="128.9" stroke="{gap}" stroke-width="10.2" stroke-linecap="round"/><line x1="127.5" y1="128.9" x2="127.6" y2="133.9" stroke="{gap}" stroke-width="8.7" stroke-linecap="round"/><line x1="127.6" y1="83" x2="125.9" y2="107" stroke="{figure}" stroke-width="8" stroke-linecap="round"/><line x1="125.9" y1="107" x2="127.5" y2="128.9" stroke="{figure}" stroke-width="7" stroke-linecap="round"/><line x1="127.5" y1="128.9" x2="127.6" y2="133.9" stroke="{figure}" stroke-width="5.5" stroke-linecap="round"/></svg>',
    },
  },
};
