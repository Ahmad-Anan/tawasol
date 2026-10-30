import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Service, inject } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { TranslateService } from '@ngx-translate/core';

/**
 * What a form does when it's submitted with invalid fields — passed as `submit()`'s `onInvalid`.
 *
 * By then `submit()` has already marked every field touched, so each field's own error shows
 * (WCAG 3.3.1). This adds the two things a keyboard/screen-reader user still needs: focus moves
 * to the first invalid field in DOM order (`errorSummary()` is sorted that way), where its
 * `aria-describedby` reads out the error, and one polite announcement says how many fields need
 * fixing. Only the first invalid field is focused, so the announcement is the only thing said
 * about the rest.
 *
 * Forms using this must carry `novalidate`: `[formField]` copies validators onto the native input
 * (`required`, `type="email"`…), and without `novalidate` the browser's own constraint validation
 * cancels the submit event, so `submit()` never runs and only an untranslated browser tooltip shows.
 */
@Service()
export class InvalidSubmit {
  private readonly announcer = inject(LiveAnnouncer);
  private readonly translate = inject(TranslateService);

  readonly onInvalid = (form: FieldTree<unknown>): void => {
    const errors = form().errorSummary();
    if (errors.length === 0) {
      return;
    }
    errors[0].fieldTree().focusBoundControl();

    // A field can hold several errors at once (e.g. required + pattern); count fields, not errors.
    const count = new Set(errors.map((error) => error.fieldTree)).size;
    void this.announcer.announce(
      this.translate.translate('shared.forms.invalidSubmit', { count })() as string,
      'polite',
    );
  };
}
