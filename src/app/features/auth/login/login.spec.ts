import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let authService: { signin: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    authService = { signin: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  function setInput(selector: string, value: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submitForm(): void {
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the "Email or username" hint but no password checklist', () => {
    expect(fixture.nativeElement.querySelector('mat-hint')?.textContent).toContain(
      'auth.login.loginHint',
    );
    expect(fixture.nativeElement.querySelector('app-password-checklist')).toBeNull();
  });

  it('does not call AuthService.signin when required fields are left empty', async () => {
    submitForm();
    await fixture.whenStable();

    expect(authService.signin).not.toHaveBeenCalled();
  });

  it('shows validation errors after submitting an empty form', async () => {
    submitForm();
    await fixture.whenStable();
    fixture.detectChanges();

    const errors = fixture.nativeElement.querySelectorAll('mat-error');
    expect(errors.length).toBe(2);
  });

  it('sends only "login" (not "email"/"username") and navigates to /feed on success', async () => {
    authService.signin.mockResolvedValue(undefined);
    setInput('input[autocomplete="username"]', 'ahmed@example.com');
    setInput('input[autocomplete="current-password"]', 'Passw0rd!');

    submitForm();
    await fixture.whenStable();

    expect(authService.signin).toHaveBeenCalledWith({
      login: 'ahmed@example.com',
      password: 'Passw0rd!',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/feed');
  });

  it('shows the API error message verbatim and does not navigate when signin fails', async () => {
    authService.signin.mockRejectedValue(
      new HttpErrorResponse({
        status: 401,
        error: { success: false, message: 'incorrect email or password' },
      }),
    );
    setInput('input[autocomplete="username"]', 'ahmed@example.com');
    setInput('input[autocomplete="current-password"]', 'wrong-password');

    submitForm();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('incorrect email or password');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  describe('Try the demo', () => {
    const demoButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('[data-testid="try-demo"]');

    it('renders a secondary button under the login form', () => {
      expect(demoButton()?.textContent).toContain('auth.login.tryDemo');
      expect(demoButton().type).toBe('button');
    });

    it('signs in with the public demo credentials through the single login field and lands on /feed', async () => {
      authService.signin.mockResolvedValue(undefined);
      demoButton().click();
      await fixture.whenStable();

      expect(authService.signin).toHaveBeenCalledTimes(1);
      expect(authService.signin).toHaveBeenCalledWith({
        login: 'tawasol_demo',
        password: 'Aa123456#',
      });
      expect(router.navigateByUrl).toHaveBeenCalledWith('/feed');
    });

    it('does not validate or submit the login form', async () => {
      authService.signin.mockResolvedValue(undefined);
      demoButton().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-error')).toBeNull();
    });

    it('shows the API error and stays on the page when the demo sign-in fails', async () => {
      authService.signin.mockRejectedValue(
        new HttpErrorResponse({
          status: 400,
          error: { success: false, message: 'incorrect email or password' },
        }),
      );
      demoButton().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'incorrect email or password',
      );
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('disables both buttons while the demo sign-in is in flight', async () => {
      let finish!: () => void;
      authService.signin.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      demoButton().click();
      fixture.detectChanges();

      const submit: HTMLButtonElement =
        fixture.nativeElement.querySelector('button[type="submit"]');
      expect(demoButton().disabled).toBe(true);
      expect(submit.disabled).toBe(true);

      finish();
      await fixture.whenStable();
    });
  });
});
