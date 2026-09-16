import { Component, inject, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import type { ApiErrorResponse, SigninRequest } from '../auth.interface';

interface LoginFormModel {
  login: string;
  password: string;
}

@Component({
  selector: 'app-login',
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  // Injected once here (constructor context) and reused inside the validator message
  // functions below, which run later outside any injection context — calling the
  // standalone `translate()` function there would throw NG0203.
  private readonly translate = inject(TranslateService);

  protected readonly model = signal<LoginFormModel>({ login: '', password: '' });
  protected readonly loginForm = form(this.model, (p) => {
    // Validator messages are functions (not plain strings) so they re-evaluate
    // reactively when the active language changes — `translate.translate()` returns a
    // signal, and calling it here registers the dependency inside the field's reactive graph.
    required(p.login, { message: () => this.translate.translate('auth.login.errors.loginRequired')() as string });
    required(p.password, {
      message: () => this.translate.translate('auth.login.errors.passwordRequired')() as string,
    });
  });

  protected readonly serverError = signal<string | null>(null);

  protected async onSubmit(): Promise<void> {
    this.serverError.set(null);
    await submit(this.loginForm, async (field) => {
      const { login, password } = field().value();
      // Verified against the live API: `login` alone accepts an email- or username-shaped
      // value with no format restriction. Sending the same value under `username` too (as
      // an earlier version of this code did) gets rejected when the value isn't
      // `^[a-z0-9_]{3,30}$` shaped (e.g. an email address) — the API validates every key
      // present in the body, so extra keys aren't harmless. `login` is the one key with no
      // such constraint, so it's the only key sent.
      const payload: SigninRequest = { login, password };
      try {
        await this.authService.signin(payload);
        // Not '/' — that route unconditionally redirects back to /auth/login (see
        // app.routes.ts), which would bounce a just-signed-in user right back here.
        this.router.navigateByUrl('/feed');
      } catch (err) {
        this.serverError.set(this.extractErrorMessage(err));
      }
      return undefined;
    });
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ApiErrorResponse | undefined;
      // The API only ever replies in English (e.g. "incorrect email or password") and
      // has no locale negotiation, so this message is shown verbatim, untranslated. Only
      // the app's own fallback string below is localized.
      if (body?.message) {
        return body.message;
      }
    }
    return this.translate.translate('auth.login.errors.unexpected')() as string;
  }
}
