import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormField, form, pattern, required, validate, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import type { ApiErrorResponse } from '../../../shared/interfaces/api-response.interface';
import { PasswordChecklist } from '../../../shared/password-checklist/password-checklist';
import { PASSWORD_PATTERN } from '../../../shared/password-checklist/password-rules';

interface ChangePasswordFormModel {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

@Component({
  selector: 'app-change-password-page',
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    PasswordChecklist,
    TranslatePipe,
  ],
  templateUrl: './change-password-page.html',
  styleUrl: './change-password-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordPage {
  private readonly authService = inject(AuthService);
  // Injected once here (constructor context) and reused inside the validator message
  // functions below, which run later outside any injection context — calling the
  // standalone `translate()` function there would throw NG0203.
  private readonly translate = inject(TranslateService);

  protected readonly model = signal<ChangePasswordFormModel>({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  protected readonly changePasswordForm = form(this.model, (p) => {
    // Validator messages are functions (not plain strings) so they re-evaluate reactively
    // when the active language changes — see Login/Register for the same pattern.
    required(p.currentPassword, {
      message: () => this.translate.translate('changePassword.errors.currentPasswordRequired')() as string,
    });

    required(p.newPassword, {
      message: () => this.translate.translate('changePassword.errors.newPasswordRequired')() as string,
    });
    // The server's exact rule, verified live and shared with Register
    // (shared/password-checklist/password-rules.ts). No message: the PasswordChecklist under the
    // field explains an unmet requirement, so the template only shows "required" as text.
    pattern(p.newPassword, PASSWORD_PATTERN);

    required(p.confirmNewPassword, {
      message: () => this.translate.translate('changePassword.errors.confirmRequired')() as string,
    });
    validate(p.confirmNewPassword, (ctx) =>
      ctx.value() === ctx.valueOf(p.newPassword)
        ? undefined
        : {
            kind: 'mismatch',
            message: this.translate.translate('changePassword.errors.confirmMismatch')() as string,
          },
    );
  });

  protected readonly serverError = signal<string | null>(null);
  protected readonly success = signal(false);

  /** The new-password field shows only its "required" error as text; the checklist covers the rest. */
  protected readonly newPasswordRequiredError = computed(() => {
    const field = this.changePasswordForm.newPassword();
    return field.touched() && field.errors().some((error) => error.kind === 'required');
  });

  protected async onSubmit(): Promise<void> {
    this.serverError.set(null);
    this.success.set(false);
    await submit(this.changePasswordForm, async (field) => {
      const { currentPassword, newPassword } = field().value();
      try {
        await this.authService.changePassword({ password: currentPassword, newPassword });
        this.success.set(true);
        this.model.set({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      } catch (err) {
        this.serverError.set(this.extractErrorMessage(err));
      }
      return undefined;
    });
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ApiErrorResponse | undefined;
      // The API only ever replies in English (e.g. "incorrect email or password" for a wrong
      // current password) and has no locale negotiation, so this message is shown verbatim,
      // untranslated — same reasoning as Login/Register's extractErrorMessage. Only the app's
      // own fallback string below is localized.
      if (body?.message) {
        return body.message;
      }
    }
    return this.translate.translate('changePassword.errors.unexpected')() as string;
  }
}
