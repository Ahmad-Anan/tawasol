import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, minLength, required, submit } from '@angular/forms/signals';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { FieldAriaInvalid } from './field-aria-invalid';
import { InvalidSubmit } from './invalid-submit';

@Component({
  imports: [FormField, FieldAriaInvalid],
  template: `
    <form novalidate (submit)="$event.preventDefault(); onSubmit()">
      <!-- A bare matInput attribute (no MatInput) just to match FieldAriaInvalid's selector. -->
      <input id="first" matInput [formField]="testForm.first" />
      <input id="second" matInput [formField]="testForm.second" />
      <input id="optional" matInput [formField]="testForm.optional" />
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestForm {
  private readonly invalidSubmit = TestBed.inject(InvalidSubmit);
  readonly sent = vi.fn();
  readonly model = signal({ first: '', second: '', optional: '' });
  // `second` gets two validators, so an empty value has two errors on one field.
  readonly testForm = form(this.model, (p) => {
    required(p.first, { message: 'first required' });
    required(p.second, { message: 'second required' });
    minLength(p.second, 3, { message: 'second too short' });
  });

  async onSubmit(): Promise<void> {
    await submit(this.testForm, {
      action: async () => {
        this.sent();
        return undefined;
      },
      onInvalid: this.invalidSubmit.onInvalid,
    });
  }
}

describe('InvalidSubmit', () => {
  let announce: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    announce = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: LiveAnnouncer, useValue: { announce } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(TestForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const submitForm = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
    };
    const input = (id: string) => el.querySelector<HTMLInputElement>(`#${id}`)!;
    const type = async (id: string, value: string) => {
      input(id).value = value;
      input(id).dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    return { fixture, submitForm, input, type };
  }

  it('focuses the first invalid field in DOM order and does not send', async () => {
    const { fixture, submitForm, input } = await render();
    await submitForm();

    expect(document.activeElement).toBe(input('first'));
    expect(fixture.componentInstance.sent).not.toHaveBeenCalled();
  });

  it('skips valid fields when choosing what to focus', async () => {
    const { submitForm, input, type } = await render();
    await type('first', 'filled');
    await submitForm();

    expect(document.activeElement).toBe(input('second'));
  });

  it('announces once, politely, counting fields rather than errors', async () => {
    const translate = vi.spyOn(TestBed.inject(TranslateService), 'translate');
    const { submitForm } = await render();
    await submitForm();

    // `second` has two errors (required + minLength) but is one field.
    expect(translate).toHaveBeenCalledWith('shared.forms.invalidSubmit', { count: 2 });
    // No translations are loaded in this test, so the key comes back as-is.
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('shared.forms.invalidSubmit', 'polite');
  });

  it('does nothing extra on a valid submit', async () => {
    const { fixture, submitForm, type } = await render();
    await type('first', 'filled');
    await type('second', 'filled');
    await submitForm();

    expect(announce).not.toHaveBeenCalled();
    expect(fixture.componentInstance.sent).toHaveBeenCalledTimes(1);
  });

  it('marks every invalid field aria-invalid on submit and keeps it in step afterwards', async () => {
    const { submitForm, input, type } = await render();
    expect(input('first').getAttribute('aria-invalid')).toBe('false');

    await submitForm();
    expect(input('first').getAttribute('aria-invalid')).toBe('true');
    expect(input('second').getAttribute('aria-invalid')).toBe('true');
    expect(input('optional').getAttribute('aria-invalid')).toBe('false');

    await type('first', 'filled');
    expect(input('first').getAttribute('aria-invalid')).toBe('false');
    await type('first', '');
    expect(input('first').getAttribute('aria-invalid')).toBe('true');
  });
});
