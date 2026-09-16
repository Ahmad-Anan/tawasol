import { Component, inject, signal } from '@angular/core';
import { FormField, form, email, minLength, pattern, required, validate, submit } from '@angular/forms/signals';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import type { ApiErrorResponse, SignupRequest } from '../auth.interface';

interface RegisterFormModel {
  name: string;
  username: string;
  email: string;
  dateOfBirth: string;
  gender: '' | 'male' | 'female';
  password: string;
  rePassword: string;
}

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

@Component({
  selector: 'app-register',
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  // Injected once here (constructor context) and reused inside the validator message
  // functions below, which run later outside any injection context — calling the
  // standalone `translate()` function there would throw NG0203.
  private readonly translate = inject(TranslateService);

  protected readonly model = signal<RegisterFormModel>({
    name: '',
    username: '',
    email: '',
    dateOfBirth: '',
    gender: '',
    password: '',
    rePassword: '',
  });

  protected readonly registerForm = form(this.model, (p) => {
    // Validator messages are functions (not plain strings) so they re-evaluate
    // reactively when the active language changes — `translate.translate()` returns a
    // signal, and calling it here registers the dependency inside the field's reactive graph.
    required(p.name, { message: () => this.translate.translate('auth.register.errors.nameRequired')() as string });

    required(p.email, { message: () => this.translate.translate('auth.register.errors.emailRequired')() as string });
    email(p.email, { message: () => this.translate.translate('auth.register.errors.emailInvalid')() as string });

    required(p.dateOfBirth, {
      message: () => this.translate.translate('auth.register.errors.dobRequired')() as string,
    });

    required(p.gender, {
      message: () => this.translate.translate('auth.register.errors.genderRequired')() as string,
    });

    required(p.password, {
      message: () => this.translate.translate('auth.register.errors.passwordRequired')() as string,
    });
    minLength(p.password, 8, {
      message: () => this.translate.translate('auth.register.errors.passwordMinLength')() as string,
    });
    pattern(p.password, PASSWORD_PATTERN, {
      message: () => this.translate.translate('auth.register.errors.passwordPattern')() as string,
    });

    required(p.rePassword, {
      message: () => this.translate.translate('auth.register.errors.rePasswordRequired')() as string,
    });
    validate(p.rePassword, (ctx) =>
      ctx.value() === ctx.valueOf(p.password)
        ? undefined
        : {
            kind: 'mismatch',
            message: this.translate.translate('auth.register.errors.passwordMismatch')() as string,
          },
    );
  });

  protected readonly serverError = signal<string | null>(null);

  protected async onSubmit(): Promise<void> {
    this.serverError.set(null);
    await submit(this.registerForm, async (field) => {
      const value = field().value();
      const payload: SignupRequest = {
        name: value.name,
        email: value.email,
        dateOfBirth: value.dateOfBirth,
        gender: value.gender as 'male' | 'female',
        password: value.password,
        rePassword: value.rePassword,
        ...(value.username ? { username: value.username } : {}),
      };
      try {
        await this.authService.signup(payload);
        // Not '/' — that route unconditionally redirects back to /auth/login (see
        // app.routes.ts), which would bounce a just-registered user right back here.
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
      // The API only ever replies in English (e.g. "user already exists") and has no
      // locale negotiation, so this message is shown verbatim, untranslated. Only the
      // app's own fallback string below is localized.
      if (body?.message) {
        return body.message;
      }
    }
    return this.translate.translate('auth.register.errors.unexpected')() as string;
  }
}
