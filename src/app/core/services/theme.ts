import { DOCUMENT, PLATFORM_ID, Service, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'tawasol-theme';
const DARK_CLASS = 'tawasol-dark';

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly mode = signal<ThemeMode>(this.resolveInitialMode());

  constructor() {
    this.applyToDocument(this.mode());
  }

  toggle(): void {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    // Synchronous on purpose: the update callback must apply its DOM change before
    // returning (or before its returned promise settles) for the browser to capture a
    // correct "after" snapshot. An async callback that defers via requestAnimationFrame
    // measured ~2.3s to resolve here once the transition entered an aborted state — that
    // stall, not the state update itself (~1ms), was the entire reported slowdown.
    const apply = () => {
      this.mode.set(mode);
      this.applyToDocument(mode);
      this.persist(mode);
    };

    if (this.isBrowser && typeof this.document.startViewTransition === 'function') {
      const transition = this.document.startViewTransition(apply);
      // The transition can be skipped/aborted by the browser for reasons outside our
      // control — `apply()` above already applied the mode change either way, so a
      // skipped animation isn't a real failure and shouldn't log as one.
      transition.ready.catch(() => {});
      transition.updateCallbackDone.catch(() => {});
      transition.finished.catch(() => {});
    } else {
      apply();
    }
  }

  private resolveInitialMode(): ThemeMode {
    if (!this.isBrowser) {
      return 'light';
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyToDocument(mode: ThemeMode): void {
    this.document.documentElement.classList.toggle(DARK_CLASS, mode === 'dark');
  }

  private persist(mode: ThemeMode): void {
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }
}
