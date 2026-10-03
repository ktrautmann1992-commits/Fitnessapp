import { BackendError } from '@/data/backend';
import { t } from '@/i18n';

/** Fehler → verständlicher deutscher Text (ohne technische Details, ohne Nutzerdaten). */
export function errorText(error: unknown): string {
  if (!(error instanceof BackendError)) {
    return t.errors.generic;
  }
  switch (error.code) {
    case 'network':
      return error.sensitive ? t.errors.networkSensitive : t.errors.networkRetry;
    case 'min_age':
      return t.errors.minAge;
    case 'consent_required':
      return t.errors.consentRequired;
    case 'not_signed_in':
      return t.errors.notSignedIn;
    case 'profile_missing':
      return t.errors.profileMissing;
    case 'invalid_code':
      return t.errors.invalidCode;
    case 'rate_limited':
      return t.errors.rateLimited;
    case 'unknown':
      return t.errors.generic;
  }
}
