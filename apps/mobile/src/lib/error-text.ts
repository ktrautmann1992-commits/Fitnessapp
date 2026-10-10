import { BackendError, type BackendErrorCode } from '@/data/backend';
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
    case 'plan_rejected':
      return t.errors.planRejected;
    case 'no_template':
      return t.errors.noTemplate;
    case 'online_only':
      return t.errors.onlineOnly;
    case 'foreign_data':
      return t.errors.foreignData;
    case 'storage_unavailable':
      return t.errors.storageUnavailable;
    case 'preference_rejected':
      return t.errors.preferenceRejected;
    case 'preference_limit':
      return t.swap.alwaysLimit;
    case 'unknown':
      return t.errors.generic;
  }
}

/** Text zu einem fehlgeschlagenen „Plan erstellen“ (Codes aus createPlan in state/app-state.tsx). */
export function createPlanErrorText(
  code: BackendErrorCode | 'incomplete' | 'invalid_inputs',
): string {
  switch (code) {
    case 'incomplete':
      return t.plan.incomplete;
    case 'invalid_inputs':
      return t.plan.invalidInputs;
    default:
      return errorText(new BackendError(code));
  }
}
