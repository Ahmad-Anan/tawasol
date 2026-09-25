/**
 * App-wide configuration. There's a single build configuration today, so there's no
 * fileReplacements setup in angular.json; add one (and a sibling environment file) if a
 * value ever needs to differ between builds.
 */
export const environment = {
  // The "Try the demo" account. These credentials are INTENTIONALLY PUBLIC: they're shipped to
  // every visitor's browser and exist so anyone can explore Tawasol without registering. They
  // are not a secret and must never be reused for a real account. The demo account itself is
  // protected in the UI instead (see core/services/demo-account.ts).
  demoLogin: 'tawasol_demo',
  demoPassword: 'Aa123456#',
};
