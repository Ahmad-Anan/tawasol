import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the navbar and a router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navbar')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('renders the router outlet inside a single focusable <main id="main">', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const mains = compiled.querySelectorAll('main');
    expect(mains.length).toBe(1);
    expect(mains[0].id).toBe('main');
    expect(mains[0].getAttribute('tabindex')).toBe('-1');
    expect(mains[0].querySelector('router-outlet')).toBeTruthy();
    expect(compiled.querySelector('header app-navbar')).toBeTruthy();
  });

  it('renders a skip link targeting #main as the first focusable element', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const focusable = compiled.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const skipLink = focusable[0];
    expect(skipLink.classList).toContain('skip-link');
    expect(skipLink.getAttribute('href')).toBe('#main');
    expect(skipLink.textContent?.trim()).toBe('shared.skipToMain');
  });

  it('moves focus to <main> when the skip link is activated', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const skipLink = compiled.querySelector<HTMLAnchorElement>('.skip-link')!;
    skipLink.focus();
    skipLink.click();

    expect(document.activeElement).toBe(compiled.querySelector('main'));
  });
});
