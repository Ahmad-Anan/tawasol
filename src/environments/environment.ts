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
  // The demo account's user `_id` (read from its own sign-in response). The app recognises the
  // demo account by comparing the signed-in user's `_id` to this — never by username — so the
  // restrictions hold however the visitor signed in, and survive a page reload.
  demoUserId: '6ab61f4f8ebe92c2c0ca67ff',
};
