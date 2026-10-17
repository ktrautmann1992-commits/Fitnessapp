import { ean13BarPattern } from '@fitnessapp/core';
import Svg, { Rect } from 'react-native-svg';

/**
 * Strichcode einer Testnummer zeichnen – nur im Testmodus (Etappe E4b, Wächter N4): So lassen sich die Testnummern
 * der Attrappe auf einem zweiten Handy anzeigen und mit der Kamera scannen, ohne echte Packung. Immer schwarz auf weiß
 * mit Ruhezone (auch im dunklen Modus), sonst lesen Scanner schlecht.
 */
const QUIET = 11;
const MODULE = 3;
const HEIGHT = 90;

/** Zusammenhängende Striche: [Anfang, Breite] in Modulen. */
function bars(bits: string): [number, number][] {
  const result: [number, number][] = [];
  for (const match of bits.matchAll(/1+/g)) result.push([match.index, match[0].length]);
  return result;
}

export function TestBarcode({ code, label }: { code: string; label: string }) {
  const bits = ean13BarPattern(code);
  if (bits === null) return null;
  const width = (bits.length + 2 * QUIET) * MODULE;
  return (
    <Svg
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      accessibilityLabel={label}
      style={{ backgroundColor: '#ffffff', alignSelf: 'flex-start' }}
    >
      <Rect x={0} y={0} width={width} height={HEIGHT} fill="#ffffff" />
      {bars(bits).map(([start, length]) => (
        <Rect
          key={start}
          x={(QUIET + start) * MODULE}
          y={8}
          width={length * MODULE}
          height={HEIGHT - 16}
          fill="#000000"
        />
      ))}
    </Svg>
  );
}
