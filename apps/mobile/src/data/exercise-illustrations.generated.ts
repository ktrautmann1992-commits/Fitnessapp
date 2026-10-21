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
