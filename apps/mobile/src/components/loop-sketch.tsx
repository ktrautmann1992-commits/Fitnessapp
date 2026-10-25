import type { LatLng } from '@fitnessapp/core';
import { brandColors, radius } from '@fitnessapp/ui';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { t } from '@/i18n';
import type { LoopMapLine } from '@/lib/loop-map-html';
import { useThemeColors } from '@/lib/theme';

/**
 * Ersatz-Skizze, wenn die Karte nicht lädt (oder im Test ohne Kacheln): alle Runden in EINEM Maßstab, die gewählte
 * kräftig in ihrer Farbe, die übrigen grau; dazu ein feines Raster und der Startpunkt. Keine Kacheln, kein Netz.
 */
export function LoopSketch({
  lines,
  selected,
  start,
  height = 260,
  testID,
}: {
  lines: readonly LoopMapLine[];
  selected: number | null;
  start: LatLng | null;
  height?: number;
  testID?: string;
}) {
  const theme = useThemeColors();
  const width = 360;
  const all = [...lines.flatMap((l) => l.points), ...(start ? [start] : [])];
  if (all.length === 0) return null;
  const lat0 = all.reduce((s, p) => s + p.lat, 0) / all.length;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  const xs = all.map((p) => p.lng * cos);
  const ys = all.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 18;
  const span = Math.max(maxX - minX, maxY - minY, 1e-4);
  const scale = Math.min(
    (width - 2 * pad) / Math.max(maxX - minX, span * 0.2),
    (height - 2 * pad) / Math.max(maxY - minY, span * 0.2),
  );
  const ox = (width - (maxX - minX) * scale) / 2;
  const oy = (height - (maxY - minY) * scale) / 2;
  const project = (p: LatLng) => ({
    x: ox + (p.lng * cos - minX) * scale,
    y: height - (oy + (p.lat - minY) * scale),
  });
  const path = (points: readonly LatLng[]) =>
    points
      .map((p, i) => {
        const { x, y } = project(p);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  const order = lines
    .map((l, i) => ({ l, i }))
    .sort((a, b) => Number(a.i === selected) - Number(b.i === selected));
  const s = start ? project(start) : null;
  const gridLines = Array.from({ length: 9 }, (_, i) => i);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={t.loop.sketchA11y(lines.length)}
      style={[styles.box, { height, backgroundColor: theme.background, borderColor: theme.border }]}
    >
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {gridLines.map((i) => (
          <Line
            key={`v${i}`}
            x1={(width / 8) * i}
            y1={0}
            x2={(width / 8) * i}
            y2={height}
            stroke={theme.border}
            strokeWidth={0.5}
          />
        ))}
        {gridLines.map((i) => (
          <Line
            key={`h${i}`}
            x1={0}
            y1={(height / 8) * i}
            x2={width}
            y2={(height / 8) * i}
            stroke={theme.border}
            strokeWidth={0.5}
          />
        ))}
        {order.map(({ l, i }) =>
          i === selected ? (
            <Path
              key={i}
              d={path(l.points)}
              stroke={l.color}
              strokeWidth={4}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            <Path
              key={i}
              d={path(l.points)}
              stroke={brandColors.grau}
              strokeOpacity={0.55}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ),
        )}
        {s ? (
          <Circle cx={s.x} cy={s.y} r={7} fill="#1E9E5A" stroke="#FFFFFF" strokeWidth={3} />
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
});
