import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { PasswordChecklist } from './password-checklist';

describe('PasswordChecklist', () => {
  let fixture: ComponentFixture<PasswordChecklist>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordChecklist],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();
    fixture = TestBed.createComponent(PasswordChecklist);
  });

  function render(password: string, invalid = false): HTMLElement {
    fixture.componentRef.setInput('password', password);
    fixture.componentRef.setInput('invalid', invalid);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function items(element: HTMLElement): HTMLLIElement[] {
    return [...element.querySelectorAll('li')];
  }

  it('is a polite live region listing all five requirements', () => {
    const element = render('');
    expect(element.querySelector('ul')?.getAttribute('aria-live')).toBe('polite');
    expect(items(element).length).toBe(5);
  });

  it('shows an empty circle for each unmet requirement and a check mark once it is met', () => {
    let element = render('');
    expect(items(element).every((li) => li.dataset['met'] === 'false')).toBe(true);
    expect(element.textContent).not.toContain('check_circle');

    element = render('Abc');
    const met = items(element).filter((li) => li.dataset['met'] === 'true');
    expect(met.length).toBe(2); // uppercase + lowercase
    expect(met.every((li) => li.querySelector('mat-icon')?.textContent?.trim() === 'check_circle')).toBe(true);

    element = render('Passw0rd!');
    expect(items(element).every((li) => li.dataset['met'] === 'true')).toBe(true);
  });

  it('re-creates an item whose state flips, so screen readers announce it in full', () => {
    const before = items(render('abc'));
    const after = items(render('Abc'));

    // "uppercase" (index 1) flipped: a new node. "length" (index 0) didn't: the same node.
    expect(after[1]).not.toBe(before[1]);
    expect(after[0]).toBe(before[0]);
  });

  it('gives each item its state as screen-reader text', () => {
    const element = render('A');
    const [length, uppercase] = items(element);
    expect(uppercase.querySelector('.sr-only')?.textContent).toContain('shared.passwordChecklist.met');
    expect(length.querySelector('.sr-only')?.textContent).toContain('shared.passwordChecklist.notMet');
  });

  it('marks unmet items with the error style only once the field is invalid', () => {
    expect(render('A', false).querySelectorAll('.rule--unmet-invalid').length).toBe(0);
    expect(render('A', true).querySelectorAll('.rule--unmet-invalid').length).toBe(4);
  });
});

describe('PasswordChecklist keyboard notice', () => {
  let fixture: ComponentFixture<PasswordChecklist>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordChecklist],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();
    fixture = TestBed.createComponent(PasswordChecklist);
  });

  function notice(password: string): HTMLElement | null {
    fixture.componentRef.setInput('password', password);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('[data-testid="keyboard-notice"]');
  }

  it('asks to switch the keyboard when the password has Arabic letters', () => {
    expect(notice('شسيب1234!')?.textContent).toContain('shared.passwordChecklist.switchKeyboard');
  });

  it('shows it for mixed Arabic and English input too', () => {
    expect(notice('Tawasol1!ش')).not.toBeNull();
  });

  it('stays hidden for English input, and disappears once the Arabic letters are removed', () => {
    expect(notice('Tawasol1!')).toBeNull();
    expect(notice('ش')).not.toBeNull();
    expect(notice('')).toBeNull();
  });

  it('sits inside a polite live region that exists before the notice appears', () => {
    notice('Tawasol1!');
    const region = fixture.nativeElement.querySelector('div[aria-live="polite"]');
    expect(region).not.toBeNull();
    notice('ش');
    expect(region.querySelector('[data-testid="keyboard-notice"]')).not.toBeNull();
  });
});
