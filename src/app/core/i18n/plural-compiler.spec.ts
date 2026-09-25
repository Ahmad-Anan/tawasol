import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateCompiler, provideTranslateService } from '@ngx-translate/core';

import { PluralCompiler } from './plural-compiler';

describe('PluralCompiler', () => {
  let translate: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTranslateService({ compiler: provideTranslateCompiler(PluralCompiler) })],
    });
    translate = TestBed.inject(TranslateService);

    translate.setTranslation('en', {
      likes: { one: '{{count}} like', other: '{{count}} likes' },
      nested: { plain: 'Hello {{name}}' },
    });
    translate.setTranslation('ar', {
      likes: {
        zero: 'zero {{count}}',
        one: 'one',
        two: 'two',
        few: 'few {{count}}',
        many: 'many {{count}}',
        other: 'other {{count}}',
      },
    });
  });

  it('picks English one/other forms', () => {
    translate.use('en');
    expect(translate.instant('likes', { count: 1 })).toBe('1 like');
    expect(translate.instant('likes', { count: 0 })).toBe('0 likes');
    expect(translate.instant('likes', { count: 5 })).toBe('5 likes');
  });

  it('picks all six Arabic categories', () => {
    translate.use('ar');
    expect(translate.instant('likes', { count: 0 })).toBe('zero 0');
    expect(translate.instant('likes', { count: 1 })).toBe('one');
    expect(translate.instant('likes', { count: 2 })).toBe('two');
    expect(translate.instant('likes', { count: 7 })).toBe('few 7');
    expect(translate.instant('likes', { count: 11 })).toBe('many 11');
    expect(translate.instant('likes', { count: 100 })).toBe('other 100');
  });

  it('leaves ordinary nested strings untouched', () => {
    translate.use('en');
    expect(translate.instant('nested.plain', { name: 'Tawasol' })).toBe('Hello Tawasol');
  });
});
