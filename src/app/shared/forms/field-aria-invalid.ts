import { Directive, ElementRef, Renderer2, afterRenderEffect, inject } from '@angular/core';
import { FormField } from '@angular/forms/signals';

/**
 * Keeps `aria-invalid` on a Signal Forms control in step with the error shown for it: "true"
 * once the field is touched and invalid (the same moment its error text appears), "false"
 * otherwise.
 *
 * matInput already binds `aria-invalid`, but leaves it off an *empty* required field on purpose
 * (Material treats it as redundant with `aria-required`), so after an empty submit a screen reader
 * hears the error text but never "invalid". It can't be fixed with a template
 * `[attr.aria-invalid]` binding: matInput's host binding writes the same attribute, and each
 * binding only rewrites it when its own value changes, so whichever changed last would win.
 * Writing after render instead always lands after matInput's binding, and re-runs whenever the
 * value or validity it depends on changes, which covers every change that can make matInput
 * rewrite it.
 */
@Directive({
  selector: 'input[matInput][formField], textarea[matInput][formField], mat-radio-group[formField]',
})
export class FieldAriaInvalid {
  constructor() {
    const formField = inject(FormField);
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const renderer = inject(Renderer2);

    afterRenderEffect({
      write: () => {
        const field = formField.state();
        // Read only so this re-runs when matInput's `empty` (and so its own binding) changes.
        field.value();
        renderer.setAttribute(element, 'aria-invalid', String(field.touched() && field.invalid()));
      },
    });
  }
}
