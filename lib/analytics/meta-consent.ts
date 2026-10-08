import { META_CONSENT_COOKIE, META_CONSENT_GRANTED, readCookie } from "./meta-shared";
export function advertisingConsent(): boolean {
  try {
    return typeof window !== "undefined" && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl !== true
      && readCookie(document.cookie, META_CONSENT_COOKIE) === META_CONSENT_GRANTED;
  } catch { return false; }
}
export function setAdvertisingConsent(granted: boolean): void {
  const permitted = granted && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl !== true;
  document.cookie = `${META_CONSENT_COOKIE}=${permitted ? META_CONSENT_GRANTED : "denied"}; Path=/; Max-Age=15552000; SameSite=Lax; Secure`;
  if (!permitted) {
    window.fbq?.("consent", "revoke");
    for (const name of ["_fbp", "_fbc"]) {
      document.cookie = `${name}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
      document.cookie = `${name}=; Domain=.iqonbody.com; Path=/; Max-Age=0; Secure; SameSite=Lax`;
    }
  }
  window.dispatchEvent(new Event("iqon-ad-consent"));
}
