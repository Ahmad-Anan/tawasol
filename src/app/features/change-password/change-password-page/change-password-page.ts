import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormField, form, minLength, pattern, required, validate, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import type { ApiErrorResponse } from '../../../shared/interfaces/api-response.interface';

interface ChangePasswordFormModel {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// Verified against the live API (see docs/api-reference.md > PATCH /users/change-password):
// min 8 chars, at least one uppercase, one lowercase, one digit, one of #?!@$%^&*- — matching
// the server's own pattern exactly so the client rejects an invalid password before a round
// trip, not some looser approximation of it.
const NEW_PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[#?!@$%^&*-]).{8,}$/;

@Component({
  selector: 'app-change-password-page',
  imports: [FormField, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, TranslatePipe],
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
    minLength(p.newPassword, 8, {
      message: () => this.translate.translate('changePassword.errors.newPasswordMinLength')() as string,
    });
    pattern(p.newPassword, NEW_PASSWORD_PATTERN, {
      message: () => this.translate.translate('changePassword.errors.newPasswordPattern')() as string,
    });

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
