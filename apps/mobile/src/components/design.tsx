import {
  areaColors,
  cardColors,
  fontSize,
  heroColors,
  radius,
  spacing,
  type AreaId,
  type AreaPalette,
} from '@fitnessapp/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { appFont, displayFont } from '@/lib/fonts';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';
import { Text } from '@/components/text';

/**
 * Bausteine des neuen Designs (Entwurf „Übersicht neu“ / „Mehr neu“, Gründer-Freigabe 20.10.2026): Strich-Icons,
 * Icon-Chips in Bereichsfarben, Kacheln, dunkle Hero-Karte, Abschnitts-Überschriften, Listenzeilen, große Zahlen,
 * Ring und Mini-Balken. Nur Darstellung – Werte (Prozent, Kilometer …) rechnet packages/core bzw. der Aufrufer.
 *
 * Regeln (docs/DESIGN.md „Bausteine“): Bereichsfarben nur in Chips und Akzenten, Text bleibt in Textfarbe.
 * Icons sind Deko (für Bildschirmleser ausgeblendet), die Bedeutung steht immer im Text daneben.
 * Tippflächen ≥ 44 px, hell und dunkel, ab 320 px Breite.
 */

/** Mindesthöhe einer Tippfläche in Listen (Apple HIG 44 pt). */
export const MIN_ROW = 44;

/** Bereichsfarben im aktuellen Hell-/Dunkelmodus. */
export function useAreaColors(area: AreaId): AreaPalette {
  return areaColors[useColorSchemeName()][area];
}

// ---------------------------------------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------------------------------------
type Shape =
  | { d: string }
  | { cx: number; cy: number; r: number }
  | { x: number; y: number; w: number; h: number; rx: number };

/** Strich-Icons (24 × 24, Strich 2, runde Enden) – Formen aus dem Entwurf, keine fremde Icon-Bibliothek. */
const ICONS = {
  dumbbell: [{ d: 'M6.5 6.5h11M6.5 17.5h11M3 9v6M21 9v6M6.5 5v14M17.5 5v14' }],
  stopwatch: [{ cx: 12, cy: 13, r: 8 }, { d: 'M12 9v4l2 2M9 2h6' }],
  utensils: [{ d: 'M7 2v8a2 2 0 0 0 4 0V2M9 10v12M17 2c-1.7 0-3 2-3 5s1.3 4 3 4v11' }],
  cart: [{ cx: 9, cy: 20, r: 1.5 }, { cx: 18, cy: 20, r: 1.5 }, { d: 'M2 3h3l3 12h11l2-8H6' }],
  run: [{ cx: 14, cy: 4, r: 2 }, { d: 'm8 21 3-6 3 2v5M6 12l3-3 4 1 3 3h3' }],
  trophy: [
    { d: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z' },
    { d: 'M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3' },
  ],
  trend: [{ d: 'M3 17l6-6 4 4 8-8' }, { d: 'M15 7h6v6' }],
  grid: [
    { x: 3, y: 3, w: 7, h: 7, rx: 2 },
    { x: 14, y: 3, w: 7, h: 7, rx: 2 },
    { x: 3, y: 14, w: 7, h: 7, rx: 2 },
    { x: 14, y: 14, w: 7, h: 7, rx: 2 },
  ],
  dots: [
    { cx: 5, cy: 12, r: 2 },
    { cx: 12, cy: 12, r: 2 },
    { cx: 19, cy: 12, r: 2 },
  ],
  book: [
    { d: 'M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2ZM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8Z' },
  ],
  recipe: [{ d: 'M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z' }, { d: 'M8 7h6M8 11h6' }],
  box: [{ x: 3, y: 7, w: 18, h: 13, rx: 2 }, { d: 'M3 11h18M8 7V4h8v3' }],
  settings: [
    { cx: 12, cy: 12, r: 3 },
    {
      d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
    },
  ],
  info: [{ cx: 12, cy: 12, r: 9 }, { d: 'M12 8h.01M11 12h1v4h1' }],
  edit: [{ d: 'M12 20h9' }, { d: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z' }],
  chevron: [{ d: 'm9 6 6 6-6 6' }],
  play: [{ d: 'M7 4v16l13-8Z' }],
  'bar-menu': [{ x: 3, y: 15, w: 18, h: 6, rx: 2 }, { d: 'M7 18h.01M11 18h.01M15 18h.01' }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  check: [{ d: 'm5 12 5 5L20 7' }],
  calendar: [{ x: 3, y: 5, w: 18, h: 16, rx: 2 }, { d: 'M3 10h18M8 3v4M16 3v4' }],
  pause: [
    { x: 6, y: 4, w: 4, h: 16, rx: 1 },
    { x: 14, y: 4, w: 4, h: 16, rx: 1 },
  ],
  stop: [{ x: 5, y: 5, w: 14, h: 14, rx: 2 }],
  trash: [{ d: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5' }],
  download: [{ d: 'M12 3v12M7 10l5 5 5-5M4 21h16' }],
  shield: [{ d: 'M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6Z' }],
  logout: [{ d: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11' }],
  swap: [{ d: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7' }],
  alert: [{ d: 'M12 3 2 20h20Z' }, { d: 'M12 10v4M12 17h.01' }],
  bell: [{ d: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4ZM10 21h4' }],
  map: [{ d: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3Z' }, { d: 'M9 3v15M15 6v15' }],
  // Auswertung je Lauf: Anstieg und höchster Punkt.
  mountain: [{ d: 'm3 20 6.5-11 4 6 2.5-3.5L21 20Z' }],
  flag: [{ d: 'M5 21V4M5 4h11l-2 4 2 4H5' }],
  scale: [{ x: 3, y: 3, w: 18, h: 18, rx: 4 }, { d: 'M8 10a4 4 0 0 1 8 0M12 10l1.5-2.5' }],
  user: [{ cx: 12, cy: 8, r: 4 }, { d: 'M4 21a8 8 0 0 1 16 0' }],
  // Supplemente (Phase 6 SU4): Kapsel.
  pill: [{ d: 'M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z' }, { d: 'm8.5 8.5 7 7' }],
  scan: [
    {
      d: 'M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8',
    },
  ],
} satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** Gefüllte statt umrissene Formen (wie im Entwurf: „Mehr“-Punkte und Play-Dreieck). */
const FILLED: ReadonlySet<IconName> = new Set(['dots', 'play', 'pause', 'stop']);

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 2,
  accessibilityLabel,
  testID,
}: {
  name: IconName;
  size?: number;
  /** Standard: Textfarbe. */
  color?: string;
  strokeWidth?: number;
  /** Nur setzen, wenn das Icon allein (ohne Text) eine Bedeutung trägt – sonst bleibt es Deko. */
  accessibilityLabel?: string;
  testID?: string;
}) {
  const theme = useThemeColors();
  const tint = color ?? theme.text;
  const filled = FILLED.has(name);
  const paint = filled
    ? { fill: tint }
    : {
        fill: 'none',
        stroke: tint,
        strokeWidth,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
      };
  const decorative = accessibilityLabel === undefined;
  return (
    <View
      testID={testID}
      style={{ width: size, height: size }}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={decorative || undefined}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {(ICONS[name] as readonly Shape[]).map((shape, index) =>
          'd' in shape ? (
            <Path key={index} d={shape.d} {...paint} />
          ) : 'cx' in shape ? (
            <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} {...paint} />
          ) : (
            <Rect
              key={index}
              x={shape.x}
              y={shape.y}
              width={shape.w}
              height={shape.h}
              rx={shape.rx}
              {...paint}
            />
          ),
        )}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Icon-Chip
// ---------------------------------------------------------------------------------------------------------
/** Quadratischer Chip in der Bereichsfarbe mit Icon (36/40 px Radius 12, 52 px Radius 16). Immer Deko. */
export function IconChip({
  area,
  icon,
  size = 36,
  testID,
}: {
  area: AreaId;
  icon: IconName;
  size?: 36 | 40 | 52;
  testID?: string;
}) {
  const palette = useAreaColors(area);
  const iconSize = size === 52 ? 26 : size === 40 ? 22 : 20;
  return (
    <View
      testID={testID}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: size === 52 ? 16 : radius.md,
          backgroundColor: palette.surface,
        },
      ]}
    >
      <Icon name={icon} size={iconSize} color={palette.icon} />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Abschnitts-Überschrift
// ---------------------------------------------------------------------------------------------------------
/** Kleine, fette Überschrift in Großbuchstaben und Grau („TRAINING & SPORT“). Für Bildschirmleser eine Überschrift. */
export function SectionLabel({
  children,
  level = 2,
  testID,
}: {
  children: string;
  level?: 2 | 3;
  testID?: string;
}) {
  const theme = useThemeColors();
  return (
    <Text
      accessibilityRole="header"
      aria-level={level}
      testID={testID}
      style={[styles.sectionLabel, appFont('bold'), { color: theme.textMuted }]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Kachel
// ---------------------------------------------------------------------------------------------------------
type TileVariant = 'header' | 'stacked' | 'row';

/**
 * Karte mit Icon-Chip und Titel.
 * - `header` (Übersicht): Chip 36 + Titel in einer Zeile, darunter `children`.
 * - `stacked` (Mehr): Chip 40 oben, darunter Titel und Untertitel, mindestens 108 px hoch.
 * - `row` (Wettkampf): Chip 52 links, rechts Kennzeile (Bereichsfarbe), Titel, Untertitel; mit Pfeil, wenn antippbar.
 * Mit `onPress` ist die ganze Kachel antippbar (Rolle `button` oder `link`); der Name für Bildschirmleser setzt sich
 * aus Kennzeile, Titel und Untertitel zusammen, wenn `accessibilityLabel` fehlt.
 */
export function Tile({
  area,
  icon,
  title,
  subtitle,
  eyebrow,
  children,
  variant = 'header',
  onPress,
  role = 'button',
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
  titleTestID,
}: {
  area: AreaId;
  icon: IconName;
  title: string;
  subtitle?: string | undefined;
  /** Kennzeile über dem Titel in Bereichsfarbe (nur Variante `row`), z. B. „Mein Wettkampf“. */
  eyebrow?: string | undefined;
  children?: ReactNode;
  variant?: TileVariant;
  onPress?: (() => void) | undefined;
  /** `link` für Kacheln, die zu einem anderen Bildschirm führen. */
  role?: 'button' | 'link';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** testID des Titels (z. B. für Prüfungen des angezeigten Namens). */
  titleTestID?: string;
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const palette = areaColors[scheme][area];
  const card = cardColors[scheme];
  const titleText = (
    <Text
      testID={titleTestID}
      style={[
        variant === 'header' ? styles.tileTitleSmall : styles.tileTitle,
        appFont('bold'),
        { color: theme.text },
      ]}
    >
      {title}
    </Text>
  );
  const subtitleText = subtitle ? (
    <Text style={[styles.tileSubtitle, appFont('regular'), { color: theme.textMuted }]}>
      {subtitle}
    </Text>
  ) : null;

  const body =
    variant === 'row' ? (
      <View style={styles.tileRow}>
        <IconChip area={area} icon={icon} size={52} />
        <View style={styles.tileRowText}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, appFont('bold'), { color: palette.icon }]}>
              {eyebrow}
            </Text>
          ) : null}
          {titleText}
          {subtitleText}
          {children}
        </View>
        {onPress ? <Icon name="chevron" color={theme.textMuted} /> : null}
      </View>
    ) : variant === 'stacked' ? (
      <>
        <IconChip area={area} icon={icon} size={40} />
        <View style={styles.tileText}>
          {titleText}
          {subtitleText}
        </View>
        {children}
      </>
    ) : (
      <>
        <View style={styles.tileHead}>
          <IconChip area={area} icon={icon} />
          <View style={styles.tileHeadText}>{titleText}</View>
        </View>
        {subtitleText}
        {children}
      </>
    );

  const boxStyle = [
    styles.tile,
    variant === 'stacked' && styles.tileStacked,
    variant === 'row' && styles.tileRowBox,
    { backgroundColor: theme.surface, borderColor: card.border },
  ];

  if (!onPress) {
    return (
      <View testID={testID} style={[boxStyle, style]}>
        {body}
      </View>
    );
  }
  const label = accessibilityLabel ?? [eyebrow, title, subtitle].filter(Boolean).join(', ');
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [boxStyle, { opacity: pressed ? 0.85 : 1 }, style]}
    >
      {body}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Hero-Karte
// ---------------------------------------------------------------------------------------------------------
/**
 * Dunkle Karte für die wichtigste Aufgabe des Tages („Training heute“): Kennzeile (Überschrift), Zusatz rechts,
 * großer Titel, Untertitel und ein großer Pillen-Knopf (52 px) in der Hauptfarbe.
 */
export function HeroCard({
  eyebrow,
  eyebrowIcon,
  meta,
  title,
  subtitle,
  actionLabel,
  onAction,
  actionIcon = 'play',
  actionRole = 'button',
  actionAccessibilityLabel,
  actionTestID,
  note,
  noteTestID,
  secondaryLabel,
  onSecondary,
  secondaryTestID,
  titleIsHeading = false,
  children,
  testID,
}: {
  eyebrow: string;
  eyebrowIcon?: IconName;
  /** Kleiner Zusatz rechts oben, z. B. „Woche 3 von 12“. */
  meta?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: IconName | null;
  actionRole?: 'button' | 'link';
  actionAccessibilityLabel?: string;
  actionTestID?: string;
  /** Kurzer Hinweis unter dem Titel (z. B. warum „Starten“ gerade nicht geht). */
  note?: string | null | undefined;
  noteTestID?: string;
  /** Zweiter, leiser Knopf (Umriss in Weiß), z. B. „Zum Training“. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryTestID?: string;
  /** true: der Titel ist die Überschrift (z. B. Name der Einheit), die Kennzeile ist nur Text. */
  titleIsHeading?: boolean;
  children?: ReactNode;
  testID?: string;
}) {
  const theme = useThemeColors();
  const hero = heroColors[useColorSchemeName()];
  return (
    <View
      testID={testID}
      style={[styles.hero, { backgroundColor: hero.background, borderColor: hero.border }]}
    >
      <View style={styles.heroTop}>
        <View style={styles.heroEyebrow}>
          {eyebrowIcon ? (
            <Icon name={eyebrowIcon} size={16} color={hero.accent} strokeWidth={2.2} />
          ) : null}
          <Text
            accessibilityRole={titleIsHeading ? undefined : 'header'}
            aria-level={titleIsHeading ? undefined : 2}
            style={[styles.eyebrow, appFont('bold'), { color: hero.accent }]}
          >
            {eyebrow}
          </Text>
        </View>
        {meta ? (
          <Text style={[styles.heroMeta, appFont('regular'), { color: hero.muted }]}>{meta}</Text>
        ) : null}
      </View>
      <View style={styles.heroText}>
        <Text
          accessibilityRole={titleIsHeading ? 'header' : undefined}
          aria-level={titleIsHeading ? 2 : undefined}
          style={[styles.heroTitle, displayFont(), { color: hero.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.heroSubtitle, appFont('regular'), { color: hero.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {note ? (
        <Text
          testID={noteTestID}
          style={[styles.heroSubtitle, appFont('regular'), { color: hero.muted }]}
        >
          {note}
        </Text>
      ) : null}
      {children}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole={actionRole}
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          onPress={onAction}
          testID={actionTestID ?? (testID ? `${testID}-action` : undefined)}
          style={({ pressed }) => [
            styles.heroButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {actionIcon ? <Icon name={actionIcon} size={18} color={theme.primaryText} /> : null}
          <Text style={[styles.heroButtonText, appFont('bold'), { color: theme.primaryText }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
          onPress={onSecondary}
          testID={secondaryTestID}
          style={({ pressed }) => [
            styles.heroSecondary,
            { borderColor: hero.muted, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.heroSecondaryText, appFont('semibold'), { color: hero.text }]}>
            {secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Listen
// ---------------------------------------------------------------------------------------------------------
/** Weiße Karte ohne Polster für `ListRow`-Zeilen (Radius 20, zarter Rand). */
export function ListGroup({ children, testID }: { children: ReactNode; testID?: string }) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  return (
    <View
      testID={testID}
      style={[styles.listGroup, { backgroundColor: theme.surface, borderColor: card.border }]}
    >
      {children}
    </View>
  );
}

/**
 * Zeile mit Icon, Text, optional Beschreibung und Pfeil; mindestens 44 px hoch.
 * - Mit `onPress`: ganze Zeile antippbar (Rolle `link` bzw. `button`), Pfeil rechts.
 * - Ohne `onPress`: reine Anzeige (z. B. Zutat), ohne Pfeil; rechts darf ein eigener Knopf (`trailing`) stehen.
 * - `tone="danger"`: destruktive Aktion (z. B. „Konto löschen“) – Text und Icon in der Fehlerfarbe, nie nur Farbe:
 *   der Text sagt, was passiert, und es folgt immer eine Rückfrage.
 */
export function ListRow({
  icon,
  label,
  description,
  onPress,
  role = 'link',
  tone = 'default',
  trailing,
  last = false,
  disabled = false,
  accessibilityHint,
  testID,
  labelTestID,
}: {
  icon?: IconName | undefined;
  label: string;
  description?: string | undefined;
  onPress?: (() => void) | undefined;
  role?: 'button' | 'link';
  tone?: 'default' | 'danger';
  /** Nur für Zeilen ohne `onPress`: eigener Knopf rechts (keine verschachtelten Tippflächen). */
  trailing?: ReactNode;
  /** Letzte Zeile der Gruppe: ohne Trennlinie. */
  last?: boolean;
  /** Gesperrt (z. B. während einer Aktion läuft) – bleibt sichtbar, ist aber nicht antippbar. */
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
  /** testID des Textes (z. B. für Prüfungen des angezeigten Inhalts). */
  labelTestID?: string;
}) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  const danger = tone === 'danger';
  const textColor = danger ? theme.danger : theme.text;
  const content = (
    <>
      {icon ? <Icon name={icon} size={22} color={danger ? theme.danger : theme.textMuted} /> : null}
      <View style={styles.listRowText}>
        <Text
          testID={labelTestID}
          style={[styles.listRowLabel, appFont(danger ? 'bold' : 'semibold'), { color: textColor }]}
        >
          {label}
        </Text>
        {description ? (
          <Text style={[styles.tileSubtitle, appFont('regular'), { color: theme.textMuted }]}>
            {description}
          </Text>
        ) : null}
      </View>
    </>
  );
  const divider = !last && { borderBottomWidth: 1, borderBottomColor: card.divider };
  if (!onPress) {
    return (
      <View testID={testID} style={[styles.listRow, divider]}>
        {content}
        {trailing}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        divider,
        { opacity: disabled ? 0.6 : pressed ? 0.7 : 1 },
      ]}
    >
      {content}
      <Icon name="chevron" size={18} color={danger ? theme.danger : theme.textMuted} />
    </Pressable>
  );
}

/** Runder Knopf nur mit Icon (44 × 44, Rand), z. B. „Übersicht bearbeiten“. Name für Bildschirmleser ist Pflicht. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  testID,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Icon name={icon} size={20} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Zahlen, Ring, Balken
// ---------------------------------------------------------------------------------------------------------
/** Große Zahl mit Beschriftung darunter („9“ / „Einheiten“). Bildschirmleser lesen beides zusammen. */
export function StatValue({
  value,
  label,
  size = 'md',
  accessibilityLabel,
  testID,
  valueTestID,
}: {
  value: string;
  label: string;
  /** md = 20 px (Fortschritt), lg = 22 px (Ausdauer, Einkaufen). */
  size?: 'md' | 'lg';
  /** Ausgeschriebene Fassung, z. B. „18,4 Kilometer diese Woche“. */
  accessibilityLabel?: string;
  testID?: string;
  /** testID nur der Zahl (z. B. für Prüfungen des angezeigten Werts ohne Beschriftung). */
  valueTestID?: string;
}) {
  const theme = useThemeColors();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${value} ${label}`}
      style={styles.stat}
    >
      <Text
        testID={valueTestID}
        style={[
          size === 'lg' ? styles.statValueLarge : styles.statValue,
          appFont('extrabold'),
          { color: theme.text },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, appFont('regular'), { color: theme.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Kreis-Fortschritt: Spur, gefüllter Bogen ab 12 Uhr im Uhrzeigersinn, darüber eine zweite Runde (zu viel).
 * Standard wie im Kalorien-Ring der Ernährung (Füllung Hauptfarbe, zweite Runde Textfarbe); mit `color` z. B. in
 * der Bereichsfarbe (`useAreaColors('ernaehrung').strong`). Die Grafik ist für Bildschirmleser ausgeblendet –
 * die Ansage in Worten setzt der Rahmen (z. B. `accessibilityRole="progressbar"` + Text).
 */
export function ProgressRing({
  size,
  stroke,
  fraction,
  overFraction = 0,
  color,
  trackColor,
  children,
}: {
  size: number;
  stroke: number;
  fraction: number;
  overFraction?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
}) {
  const theme = useThemeColors();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = (part: number, arcColor: string, key: string) =>
    part > 0 ? (
      <Circle
        key={key}
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={arcColor}
        strokeWidth={stroke}
        strokeLinecap={part >= 1 ? 'butt' : 'round'}
        strokeDasharray={`${c * Math.min(part, 1)} ${c}`}
        fill="none"
      />
    ) : null;
  return (
    <View style={{ width: size, height: size }}>
      {/* Gedreht um −90°: der Bogen beginnt oben (12 Uhr). */}
      <View
        style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={size} height={size} aria-hidden>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={trackColor ?? theme.border}
            strokeWidth={stroke}
            fill="none"
          />
          {arc(fraction, color ?? theme.primary, 'fill')}
          {arc(overFraction, theme.text, 'over')}
        </Svg>
      </View>
      {children ? <View style={styles.ringCenter}>{children}</View> : null}
    </View>
  );
}

/**
 * Mini-Balken (z. B. Kilometer je Wochentag): Werte 0–1, hervorgehobener Balken kräftig, die anderen zart, leere
 * Tage als flache Linie. Ein Bild mit Ansage in Worten (`accessibilityLabel` ist Pflicht).
 */
export function MiniBars({
  values,
  area,
  highlightIndex,
  height = 24,
  accessibilityLabel,
  testID,
}: {
  /** Anteile 0–1 (der Aufrufer bzw. packages/core rechnet sie aus). */
  values: readonly number[];
  area: AreaId;
  highlightIndex?: number | undefined;
  height?: number;
  accessibilityLabel: string;
  testID?: string;
}) {
  const palette = useAreaColors(area);
  const card = cardColors[useColorSchemeName()];
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.bars, { height }]}
    >
      {values.map((raw, index) => {
        const value = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 1) : 0;
        const empty = value === 0;
        return (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: empty ? 3 : Math.max(3, Math.round(value * height)),
                backgroundColor: empty
                  ? card.border
                  : index === highlightIndex
                    ? palette.strong
                    : palette.soft,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Fortschritt, große Knöpfe, Nummern
// ---------------------------------------------------------------------------------------------------------
/**
 * Fortschrittsbalken in der Bereichsfarbe (z. B. Trainingsblau: erledigte Übungen der Einheit). Rolle
 * „Fortschrittsanzeige“ mit Wert und Ansage in Worten; `onDark` für die dunkle Hero-Karte.
 */
export function AreaProgress({
  area,
  current,
  total,
  accessibilityLabel,
  onDark = false,
  testID,
}: {
  area: AreaId;
  current: number;
  total: number;
  /** Ansage in Worten, z. B. „Übung 2 von 5“. */
  accessibilityLabel: string;
  onDark?: boolean;
  testID?: string;
}) {
  const palette = useAreaColors(area);
  const card = cardColors[useColorSchemeName()];
  const hero = heroColors[useColorSchemeName()];
  const fraction = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: total, now: current, text: accessibilityLabel }}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current}
      style={[
        styles.progressTrack,
        // Spur auf Dunkel: zartes Weiß (Deko); die Füllung in Himmelblau hebt sich ≥ 3 : 1 ab.
        { backgroundColor: onDark ? 'rgba(255, 255, 255, 0.2)' : card.border },
      ]}
    >
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.round(fraction * 100)}%`,
            backgroundColor: onDark ? hero.accent : palette.strong,
          },
        ]}
      />
    </View>
  );
}

/**
 * Großer Pillen-Knopf in der Bereichsfarbe (z. B. Ausdauer-Orange für Start/Pause/Stopp). `filled`: Fläche in der
 * Akzentfarbe (hell: Weiß auf `icon` ≥ 4,5 : 1, dunkel: Schwarz auf `icon`); `outline`: Rand und Text in `icon`.
 * Mindestens 64 px hoch (große Tippfläche unterwegs).
 */
export function AreaButton({
  area,
  label,
  onPress,
  icon,
  variant = 'filled',
  accessibilityLabel,
  disabled = false,
  testID,
}: {
  area: AreaId;
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'filled' | 'outline';
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const palette = areaColors[scheme][area];
  const filled = variant === 'filled';
  const textColor = filled
    ? scheme === 'dark'
      ? heroColors.light.background
      : '#FFFFFF'
    : palette.icon;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.areaButton,
        filled
          ? { backgroundColor: palette.icon }
          : { backgroundColor: theme.surface, borderColor: palette.icon, borderWidth: 2 },
        { opacity: disabled ? 0.6 : pressed ? 0.85 : 1 },
      ]}
    >
      {icon ? <Icon name={icon} size={22} color={textColor} /> : null}
      <Text style={[styles.areaButtonText, appFont('extrabold'), { color: textColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Runde Nummer in der Bereichsfarbe (z. B. Schritt 1, 2, 3 im Rezept). Deko – die Zahl steht im Namen der Zeile. */
export function NumberChip({ area, value }: { area: AreaId; value: number }) {
  const palette = useAreaColors(area);
  const theme = useThemeColors();
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.numberChip, { backgroundColor: palette.surface }]}
    >
      <Text style={[styles.numberChipText, appFont('extrabold'), { color: theme.text }]}>
        {String(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // Großbuchstaben nur in der Darstellung – Bildschirmleser lesen den normalen Text.
  sectionLabel: { fontSize: fontSize.xs, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: fontSize.xs, letterSpacing: 0.6, textTransform: 'uppercase' },
  tile: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 10,
    minWidth: 0,
  },
  tileStacked: { padding: 14, minHeight: 108 },
  tileRowBox: { minHeight: MIN_ROW },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tileHeadText: { flex: 1, minWidth: 0 },
  tileText: { gap: 2 },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tileRowText: { flex: 1, minWidth: 0, gap: 2 },
  tileTitleSmall: { fontSize: 15, lineHeight: 20 },
  tileTitle: { fontSize: 16, lineHeight: 22 },
  tileSubtitle: { fontSize: fontSize.xs, lineHeight: 18 },
  hero: { borderRadius: radius.lg, borderWidth: 1, padding: 20, gap: 14 },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMeta: { fontSize: fontSize.xs },
  heroText: { gap: spacing.xs },
  heroTitle: { fontSize: 24, lineHeight: 30 },
  heroSubtitle: { fontSize: 15, lineHeight: 21 },
  heroButton: {
    minHeight: 52,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  heroButtonText: { fontSize: 17 },
  heroSecondary: {
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  heroSecondaryText: { fontSize: fontSize.md },
  listGroup: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  listRow: {
    minHeight: MIN_ROW + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  listRowText: { flex: 1, minWidth: 0, gap: 2 },
  listRowLabel: { fontSize: fontSize.md, lineHeight: 22 },
  iconButton: {
    width: MIN_ROW,
    height: MIN_ROW,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stat: { gap: 2, minWidth: 0 },
  statValue: { fontSize: 20, lineHeight: 26 },
  statValueLarge: { fontSize: 22, lineHeight: 28 },
  statLabel: { fontSize: fontSize.xs, lineHeight: 18 },
  ringCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  areaButton: {
    minHeight: 64,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  areaButtonText: { fontSize: 19 },
  numberChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  numberChipText: { fontSize: fontSize.md },
  bar: { flex: 1, borderRadius: 3 },
});
