import { useRouter, type Href } from 'expo-router';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading } from '@/components/ui';
import { t } from '@/i18n';

/**
 * Einstellungen → „Lizenzen und Quellen“ (Etappe E4a, docs/PLAN-E4.md 6.1): Namensnennung der Nährwert-Quellen –
 * BLS 4.0 (Max Rubner-Institut, CC BY 4.0) und Open Food Facts (ODbL 1.0 / DbCL 1.0, Muster-Hinweis nach ODbL 4.3) –
 * und die Methode unserer Änderungen an OFF-Daten (ODbL 4.6 b); dazu Software von Dritten (Strichcode-Leser, E4b) und Schriften (OFL). Gleicher Inhalt wie die Website (/lizenzen). Ohne
 * Anmeldung erreichbar (keine Daten). Wortlaut vor dem Livegang juristisch prüfen.
 */
export default function LicensesScreen() {
  const router = useRouter();
  const L = t.foodProduct.licenses;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings' as Href));
  return (
    <Screen
      title={L.title}
      testID="licenses"
      footer={
        <Button label={t.foodLog.done} variant="secondary" onPress={back} testID="licenses-done" />
      }
    >
      <Body muted>{L.draft}</Body>
      <Heading level={2}>{L.blsTitle}</Heading>
      <Card>
        <Body testID="licenses-bls">{L.bls}</Body>
      </Card>
      <Heading level={2}>{L.offTitle}</Heading>
      <Card>
        <Body testID="licenses-off">{L.off}</Body>
        <Body muted>{L.images}</Body>
      </Card>
      <Heading level={2}>{L.methodTitle}</Heading>
      <Card>
        <Body testID="licenses-method">{L.method}</Body>
      </Card>
      <Heading level={2}>{L.softwareTitle}</Heading>
      <Card>
        <Body testID="licenses-software">{L.software}</Body>
      </Card>
      <Heading level={2}>{L.fontsTitle}</Heading>
      <Card>
        <Body testID="licenses-fonts">{L.fonts}</Body>
      </Card>
    </Screen>
  );
}
