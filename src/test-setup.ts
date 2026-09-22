// jsdom doesn't implement `window.matchMedia`, which `ThemeService.resolveInitialMode()`
// calls unconditionally on construction — without this polyfill every test that transitively
// injects `ThemeService` (directly or via a component that injects it) throws
// `TypeError: window.matchMedia is not a function` before any assertion runs.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
