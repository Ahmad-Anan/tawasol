import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { Register } from './register';

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let authService: { signup: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    authService = { signup: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  function setInput(selector: string, value: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function chooseGender(value: 'male' | 'female'): void {
    const radio: HTMLInputElement = fixture.nativeElement.querySelector(
      `mat-radio-button[value="${value}"] input[type="radio"]`,
    );
    radio.click();
    fixture.detectChanges();
  }

  function submitForm(): void {
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  function fillValidForm(): void {
    setInput('input[autocomplete="name"]', 'Ahmed Anan');
    setInput('input[autocomplete="email"]', 'ahmed@example.com');
    setInput('input[type="date"]', '2000-01-01');
    chooseGender('male');
    setInput('input[autocomplete="new-password"]', 'Passw0rd!');
    const inputs = fixture.nativeElement.querySelectorAll('input[autocomplete="new-password"]');
    const rePassword = inputs[1] as HTMLInputElement;
    rePassword.value = 'Passw0rd!';
    rePassword.dispatchEvent(new Event('input'));
  }

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('does not call AuthService.signup when required fields are left empty', async () => {
    submitForm();
    await fixture.whenStable();

    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('flags a mismatched confirmation password without calling signup', async () => {
    setInput('input[autocomplete="name"]', 'Ahmed Anan');
    setInput('input[autocomplete="email"]', 'ahmed@example.com');
    setInput('input[type="date"]', '2000-01-01');
    chooseGender('male');
    setInput('input[autocomplete="new-password"]', 'Passw0rd!');
    const inputs = fixture.nativeElement.querySelectorAll('input[autocomplete="new-password"]');
    const rePassword = inputs[1] as HTMLInputElement;
    rePassword.value = 'SomethingElse1!';
    rePassword.dispatchEvent(new Event('input'));

    submitForm();
    await fixture.whenStable();

    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('sends the full payload (with gender) and navigates to /feed on success', async () => {
    authService.signup.mockResolvedValue(undefined);
    fillValidForm();

    submitForm();
    await fixture.whenStable();

    expect(authService.signup).toHaveBeenCalledWith({
      name: 'Ahmed Anan',
      email: 'ahmed@example.com',
      dateOfBirth: '2000-01-01',
      gender: 'male',
      password: 'Passw0rd!',
      rePassword: 'Passw0rd!',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/feed');
  });

  it('includes username in the payload only when one was entered', async () => {
    authService.signup.mockResolvedValue(undefined);
    fillValidForm();
    setInput('input[autocomplete="username"]', 'ahmedanan');

    submitForm();
    await fixture.whenStable();

    expect(authService.signup).toHaveBeenCalledWith(expect.objectContaining({ username: 'ahmedanan' }));
  });

  it('shows the API error message verbatim and does not navigate when signup fails', async () => {
    authService.signup.mockRejectedValue(
      new HttpErrorResponse({ status: 409, error: { success: false, message: 'user already exists' } }),
    );
    fillValidForm();

    submitForm();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('user already exists');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
