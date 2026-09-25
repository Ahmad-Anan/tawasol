import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { passwordRuleStatus } from './password-rules';

/**
 * Live checklist of the password requirements, shown as the password field's hint on the
 * register and change-password forms (never on login). Each item turns into a check mark as it
 * is satisfied.
 *
 * Screen readers: the list is a polite live region, and each item is tracked by id *and* state,
 * so an item whose state flips is re-created rather than patched — a live region announces an
 * added node in full ("An uppercase letter, done"), whereas patching only the status text would
 * announce a context-free "done".
 */
@Component({
  selector: 'app-password-checklist',
  imports: [MatIcon, TranslatePipe],
  templateUrl: './password-checklist.html',
  styleUrl: './password-checklist.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordChecklist {
  readonly password = input.required<string>();
  /** True once the field is showing as invalid (touched) — unmet items then use the error color. */
  readonly invalid = input(false);

  protected readonly rules = computed(() => passwordRuleStatus(this.password()));
}
