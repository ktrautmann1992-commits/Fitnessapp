import type { WidgetView } from '@fitnessapp/core';
import {
  FlexWidget,
  SvgWidget,
  TextWidget,
  type WidgetRepresentation,
} from 'react-native-android-widget';

import { ringSvg, widgetLayout, type WidgetLayout, widgetSize } from './widget-layout';

/**
 * Widget „Alpha5 – Heute“ für Android (react-native-android-widget, docs/PLAN-WIDGET.md 4): blaues Feld mit dem
 * Training (Name oder „Ruhetag“), orange Kachel mit Schritte-Ring, grüne Kachel mit „kcal übrig“. Klein (2 × 2): Zahlen
 * als zwei Chips unter dem Training; mittel (4 × 2): Training links, Kacheln rechts. Hell und dunkel nach Systemdesign.
 * Das ganze Widget ist EINE Tippfläche → „Heute“ (bzw. Einstellungen, solange es aus ist).
 */
export { TODAY_WIDGET_NAME } from './widget-names';

function StepsRing({ layout, size }: { layout: WidgetLayout; size: number }) {
  const p = layout.palette;
  const steps = layout.steps;
  if (!steps) return null;
  return (
    <SvgWidget
      style={{ width: size, height: size }}
      svg={ringSvg({
        fraction: steps.reached ? 1 : steps.fraction,
        color: steps.reached ? p.success : p.stepsStrong,
        track: p.stepsTrack,
        size,
        stroke: Math.round(size / 7),
      })}
    />
  );
}

function TrainingBlock({ layout }: { layout: WidgetLayout }) {
  const p = layout.palette;
  const medium = layout.size === 'medium';
  return (
    <FlexWidget
      // Gewicht (flex) nur in Richtung der Eltern-Achse, quer dazu volle Größe (LinearLayout-Regeln).
      style={{
        flex: 1,
        ...(medium ? { height: 'match_parent' as const } : { width: 'match_parent' as const }),
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 16,
        backgroundGradient: { from: p.trainingFrom, to: p.trainingTo, orientation: 'TL_BR' },
      }}
    >
      <TextWidget
        text={layout.eyebrow}
        style={{ fontSize: 11, fontWeight: '800', color: p.trainingMuted, letterSpacing: 0.1 }}
      />
      <TextWidget
        text={layout.title}
        maxLines={medium ? 3 : 2}
        truncate="END"
        style={{ fontSize: medium ? 19 : 16, fontWeight: '800', color: p.trainingText }}
      />
      {layout.subtitle ? (
        <TextWidget
          text={layout.subtitle}
          maxLines={2}
          truncate="END"
          style={{ fontSize: 12, color: p.trainingMuted }}
        />
      ) : (
        <TextWidget text=" " style={{ fontSize: 4 }} />
      )}
    </FlexWidget>
  );
}

function SmallMetrics({ layout }: { layout: WidgetLayout }) {
  const p = layout.palette;
  if (!layout.steps && !layout.kcal) {
    return layout.note ? (
      <TextWidget
        text={layout.note}
        maxLines={2}
        style={{ fontSize: 11, color: p.muted, marginTop: 6 }}
      />
    ) : null;
  }
  return (
    <FlexWidget
      style={{ width: 'match_parent', flexDirection: 'row', flexGap: 6, marginTop: 6, height: 46 }}
    >
      {layout.steps ? (
        <FlexWidget
          style={{
            flex: 1,
            height: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: p.stepsSurface,
            borderRadius: 14,
            paddingHorizontal: 6,
          }}
        >
          <StepsRing layout={layout} size={30} />
          <TextWidget
            text={layout.steps.value}
            maxLines={1}
            style={{ fontSize: 13, fontWeight: '800', color: p.stepsText, marginLeft: 4 }}
          />
        </FlexWidget>
      ) : null}
      {layout.kcal ? (
        <FlexWidget
          style={{
            flex: 1,
            height: 'match_parent',
            flexDirection: 'column',
            justifyContent: 'center',
            backgroundColor: p.kcalSurface,
            borderRadius: 14,
            paddingHorizontal: 8,
          }}
        >
          <TextWidget
            text={layout.kcal.value}
            maxLines={1}
            style={{
              fontSize: 14,
              fontWeight: '800',
              color: layout.kcal.over ? p.over : p.kcalText,
            }}
          />
          <TextWidget
            text={layout.kcal.caption}
            maxLines={1}
            style={{ fontSize: 10, color: layout.kcal.over ? p.over : p.kcalText }}
          />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

function MediumMetrics({ layout }: { layout: WidgetLayout }) {
  const p = layout.palette;
  if (!layout.steps && !layout.kcal && !layout.note) return null;
  return (
    <FlexWidget
      style={{
        flex: 1,
        height: 'match_parent',
        flexDirection: 'column',
        flexGap: 8,
        marginLeft: 8,
      }}
    >
      {layout.steps ? (
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: p.stepsSurface,
            borderRadius: 16,
            paddingHorizontal: 10,
          }}
        >
          <StepsRing layout={layout} size={44} />
          <FlexWidget style={{ flexDirection: 'column', marginLeft: 8 }}>
            <TextWidget
              text={layout.steps.value}
              maxLines={1}
              style={{ fontSize: 17, fontWeight: '800', color: p.stepsText }}
            />
            <TextWidget
              text={layout.steps.caption}
              maxLines={1}
              style={{ fontSize: 11, color: p.stepsText }}
            />
          </FlexWidget>
        </FlexWidget>
      ) : null}
      {layout.kcal ? (
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            flexDirection: 'column',
            justifyContent: 'center',
            backgroundColor: p.kcalSurface,
            borderRadius: 16,
            paddingHorizontal: 12,
          }}
        >
          <TextWidget
            text={layout.kcal.value}
            maxLines={1}
            style={{
              fontSize: 17,
              fontWeight: '800',
              color: layout.kcal.over ? p.over : p.kcalText,
            }}
          />
          <TextWidget
            text={layout.kcal.caption}
            maxLines={1}
            style={{ fontSize: 11, color: layout.kcal.over ? p.over : p.kcalText }}
          />
        </FlexWidget>
      ) : null}
      {layout.note ? (
        <TextWidget text={layout.note} maxLines={2} style={{ fontSize: 11, color: p.muted }} />
      ) : null}
    </FlexWidget>
  );
}

export function TodayWidget({ layout }: { layout: WidgetLayout }) {
  const medium = layout.size === 'medium';
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: layout.uri }}
      accessibilityLabel={layout.a11y}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: medium ? 'row' : 'column',
        backgroundColor: layout.palette.background,
        borderRadius: 22,
        padding: 8,
      }}
    >
      <TrainingBlock layout={layout} />
      {medium ? <MediumMetrics layout={layout} /> : <SmallMetrics layout={layout} />}
    </FlexWidget>
  );
}

/** Hell und dunkel – Android wählt nach dem Systemdesign. `widthDp` = aktuelle Breite des Widgets. */
export function renderTodayWidget(view: WidgetView, widthDp: number): WidgetRepresentation {
  const size = widgetSize(widthDp);
  return {
    light: <TodayWidget layout={widgetLayout(view, size, 'light')} />,
    dark: <TodayWidget layout={widgetLayout(view, size, 'dark')} />,
  };
}
