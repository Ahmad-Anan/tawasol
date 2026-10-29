import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Language } from './test';

const I18N_ROOT = join(__dirname, '..', '..', 'public', 'i18n');

const cache = new Map<Language, Record<string, unknown>>();

/** All of the app's translation files for one language, merged the way the app's loader does. */
function translations(lang: Language): Record<string, unknown> {
  let merged = cache.get(lang);
  if (!merged) {
    merged = {};
    for (const feature of readdirSync(I18N_ROOT)) {
      Object.assign(
        merged,
        JSON.parse(readFileSync(join(I18N_ROOT, feature, `${lang}.json`), 'utf8')),
      );
    }
    cache.set(lang, merged);
  }
  return merged;
}

/**
 * The app's own string for `key` (e.g. 'feed.postCard.viewLikes'), so a spec can find an
 * element by its accessible name in either language without duplicating translations.
 */
export function t(lang: Language, key: string): string {
  const value = lookup(lang, key);
  if (typeof value !== 'string') {
    throw new Error(`No ${lang} translation for "${key}"`);
  }
  return value;
}

/**
 * A plural string (`{ "one": …, "other": … }`) for `count`, picked the way the app's
 * PluralCompiler does (core/i18n/plural-compiler.ts): Intl.PluralRules, falling back to `other`.
 */
export function tCount(lang: Language, key: string, count: number): string {
  const forms = lookup(lang, key) as Record<string, string> | undefined;
  const form = forms?.[new Intl.PluralRules(lang).select(count)] ?? forms?.['other'];
  if (typeof form !== 'string') {
    throw new Error(`No ${lang} plural translation for "${key}"`);
  }
  return form.replaceAll('{{count}}', String(count));
}

function lookup(lang: Language, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], translations(lang));
}
