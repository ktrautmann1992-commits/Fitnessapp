import { SectionLabel } from '@/components/design';
import { Body, Card, Checkbox, Notice } from '@/components/ui';
import { t } from '@/i18n';

import { WIDGET_SUPPORTED } from './widget-bridge';
import { setWidgetEnabled, useWidgetPrefs } from './widget-prefs';

/**
 * Einstellungen → „Widget auf dem Startbildschirm“ (docs/PLAN-WIDGET.md 3): Standard aus, mit Hinweis, dass der
 * Inhalt auf dem Startbildschirm sichtbar ist. Nur Android; Browser und iPhone zeigen einen kurzen Hinweis.
 */
export function WidgetSettings() {
  const prefs = useWidgetPrefs();
  const texts = t.widget.settings;
  return (
    <>
      <SectionLabel>{texts.section}</SectionLabel>
      <Card>
        {WIDGET_SUPPORTED ? (
          <>
            <Checkbox
              label={texts.toggle}
              checked={prefs.enabled}
              onChange={(value) => void setWidgetEnabled(value).catch(() => undefined)}
              testID="settings-widget"
            />
            <Body muted>{texts.hint}</Body>
            {prefs.enabled ? (
              <Notice tone="info" testID="settings-widget-howto">
                {texts.howTo}
              </Notice>
            ) : null}
          </>
        ) : (
          <Body muted testID="settings-widget-unsupported">
            {texts.onlyAndroid}
          </Body>
        )}
      </Card>
    </>
  );
}
