import { brandColors } from '@fitnessapp/ui';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Marken-Bausteine (Logo, Häkchen, Schein) als Vektorgrafik über react-native-svg.
 * Das Logo ist packages/ui/brand/alpha5-mark.svg – Pfade unverändert übernommen (docs/DESIGN.md:
 * nie durch Text ersetzen, nie umfärben oder verzerren).
 */

/** Seitenverhältnis des Logos (viewBox 1133 × 697). */
const MARK_RATIO = 697 / 1133;

const MARK_ALPHA =
  'M402 263 430 145H579L470 416L481 513Q484 538 495.5 550.0Q507 562 530 565L460 696Q359 684 350 601L348 576Q314 638 273.0 667.5Q232 697 176 697Q96 697 48.0 641.5Q0 586 0 483Q0 399 27.5 317.5Q55 236 114.5 181.5Q174 127 265 127Q389 127 402 263ZM176 480Q176 527 188.5 547.5Q201 568 227 568Q258 568 286.5 530.5Q315 493 343 402Q339 320 324.0 287.5Q309 255 277 255Q243 255 220.0 295.0Q197 335 186.5 388.0Q176 441 176 480Z';
const MARK_FIVE =
  'M1096 126H861L843 251Q888 229 942 229Q1016 229 1061.0 278.0Q1106 327 1106 417Q1106 480 1074.5 544.5Q1043 609 974.5 653.0Q906 697 802 697Q662 697 582 591L688 501Q736 564 807 564Q862 564 894.5 526.0Q927 488 927 427Q927 349 857 349Q836 349 817.0 354.0Q798 359 775 373H657L709 0H1133Z';

/** Logo „α5“ in Markenblau. `label` = Text für Screenreader (ohne label: rein dekorativ). */
export function Alpha5Mark({ width, label }: { width: number; label?: string }) {
  const height = Math.round(width * MARK_RATIO);
  return (
    <View
      accessible={label != null}
      accessibilityRole={label != null ? 'image' : undefined}
      accessibilityLabel={label}
      aria-hidden={label == null ? true : undefined}
      style={{ width, height }}
    >
      <Svg {...HIDDEN} width={width} height={height} viewBox="0 0 1133 697">
        <Path fill={brandColors.blau} d={MARK_ALPHA} />
        <Path fill={brandColors.blau} d={MARK_FIVE} />
      </Svg>
    </View>
  );
}

/** Svg selbst ist für Screenreader immer unsichtbar – die Beschreibung trägt der umgebende View. */
const HIDDEN = {
  'aria-hidden': true,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** Häkchen im Kreis (dekorativ; der Text daneben trägt die Aussage). */
export function CheckBadge({ size = 28 }: { size?: number }) {
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg {...HIDDEN} width={size} height={size} viewBox="0 0 28 28">
        <Rect x={0} y={0} width={28} height={28} rx={14} fill={brandColors.blau} />
        <Path
          d="M8.5 14.5l3.6 3.6L19.5 10"
          fill="none"
          stroke={brandColors.weiss}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** Gestrichelter Kreis mit Uhr – „kommt bald“, bewusst ohne Häkchen (dekorativ). */
export function SoonBadge({ size = 28 }: { size?: number }) {
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg {...HIDDEN} width={size} height={size} viewBox="0 0 28 28">
        <Rect
          x={1}
          y={1}
          width={26}
          height={26}
          rx={13}
          fill="none"
          stroke={brandColors.grauDunkel}
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        <Path
          d="M14 8.5V14l3.5 2.5"
          fill="none"
          stroke={brandColors.grauDunkel}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** Blauer Schein hinter dem Logo – wie beim App-Icon und dem Open-Graph-Bild (dekorativ). */
export function BrandGlow() {
  return (
    <View aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg {...HIDDEN} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="alpha5-glow" cx="30%" cy="22%" rx="80%" ry="40%">
            <Stop offset="0" stopColor={brandColors.blau} stopOpacity={0.32} />
            <Stop offset="0.55" stopColor={brandColors.blau} stopOpacity={0.08} />
            <Stop offset="1" stopColor={brandColors.blau} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#alpha5-glow)" />
      </Svg>
    </View>
  );
}
