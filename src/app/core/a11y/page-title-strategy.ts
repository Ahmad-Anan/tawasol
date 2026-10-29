import { Service, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

/** Used until the translation files have loaded, and on routes that set no `title`. */
const FALLBACK_BRAND = 'Tawasol';

/**
 * Sets `document.title` to "<Page title> · Tawasol" (or "<عنوان الصفحة> · تواصل").
 *
 * A route's `title` is a translation key (e.g. `shared.pageTitles.feed`), not display text, so
 * the title follows the active language. `instant()` reads ngx-translate's signals (current
 * language and loaded translations), so `documentTitle` recomputes on a language switch, and the
 * effect re-applies it without a new navigation.
 */
@Service()
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);

  private readonly pageKey = signal<string | null>(null);

  /** The translated page title alone (no brand). `null` while it can't be translated yet. */
  readonly pageTitle = computed(() => {
    const key = this.pageKey();
    if (!key) {
      return null;
    }
    const page = this.translate.instant(key);
    // instant() echoes the key back while translations are still loading.
    return typeof page === 'string' && page !== key ? page : null;
  });

  readonly documentTitle = computed(() => {
    const brand = this.translate.instant('navbar.brand');
    const resolvedBrand =
      typeof brand === 'string' && brand !== 'navbar.brand' ? brand : FALLBACK_BRAND;
    const page = this.pageTitle();
    return page ? `${page} · ${resolvedBrand}` : resolvedBrand;
  });

  constructor() {
    super();
    effect(() => this.title.setTitle(this.documentTitle()));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.pageKey.set(this.buildTitle(snapshot) ?? null);
  }
}
