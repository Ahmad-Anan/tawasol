import { Injectable, inject } from '@angular/core';
import {
  InterpolatableTranslation,
  InterpolatableTranslationObject,
  InterpolationParameters,
  TranslateCompiler,
  TranslateParser,
  TranslationObject,
} from '@ngx-translate/core';

const PLURAL_CATEGORIES: ReadonlySet<string> = new Set<Intl.LDMLPluralRule>([
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
]);

/**
 * Adds CLDR plural support to ngx-translate, which has none built in. A translation value
 * written as an object keyed only by plural categories (and always including `other`), e.g.
 *
 * ```json
 * "likes": { "one": "{{count}} like", "other": "{{count}} likes" }
 * ```
 *
 * is compiled into a function that picks the category for `params.count` via
 * `Intl.PluralRules` for that file's own language, then interpolates the chosen string with
 * the regular parser — so call sites stay plain `'key' | translate: { count: n }`. Arabic uses
 * all six categories (zero/one/two/few/many/other), English only one/other; any category a
 * language's JSON leaves out falls back to `other`.
 *
 * Runs once per language load (`compileTranslations` receives the merged per-feature JSON plus
 * its language code), so each language's functions are bound to that language's rules — not
 * to whichever language happens to be active when a key is later rendered.
 */
@Injectable()
export class PluralCompiler extends TranslateCompiler {
  private readonly parser = inject(TranslateParser);

  compile(value: string): InterpolatableTranslation {
    return value;
  }

  compileTranslations(translations: TranslationObject, lang: string): InterpolatableTranslationObject {
    return this.compileObject(translations, new Intl.PluralRules(lang));
  }

  private compileObject(object: TranslationObject, rules: Intl.PluralRules): InterpolatableTranslationObject {
    const compiled: InterpolatableTranslationObject = {};
    for (const [key, value] of Object.entries(object)) {
      if (isPluralForms(value)) {
        compiled[key] = (params?: InterpolationParameters) => {
          const category = rules.select(Number(params?.['count'] ?? 0));
          return this.parser.interpolate(value[category] ?? value['other'], params) ?? '';
        };
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        compiled[key] = this.compileObject(value, rules);
      } else {
        compiled[key] = value;
      }
    }
    return compiled;
  }
}

function isPluralForms(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  return (
    'other' in value &&
    entries.every(([category, form]) => PLURAL_CATEGORIES.has(category) && typeof form === 'string')
  );
}
