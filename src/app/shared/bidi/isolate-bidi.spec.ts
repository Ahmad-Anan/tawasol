import { isolateBidi } from './isolate-bidi';

describe('isolateBidi', () => {
  it('wraps text in FSI … PDI so it takes its own direction inside a translated string', () => {
    expect(isolateBidi('أحمد')).toBe('⁨أحمد⁩');
  });
});
