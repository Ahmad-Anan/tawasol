import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../features/notifications/services/notifications.service';
import { Navbar } from './navbar';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([]), provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Navbar account menu', () => {
  async function openMenuAs(userId: string): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        {
          provide: AuthService,
          useValue: {
            user: signal({
              _id: userId,
              name: 'Someone',
              username: 'someone',
              photo: 'https://example.com/a.png',
            }),
            isAuthenticated: () => true,
            token: () => 'token',
            logout: () => undefined,
          },
        },
        // The unread-count tracking isn't what's under test here.
        {
          provide: NotificationsService,
          useValue: { unreadCount: () => 0, hasUnread: () => false },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button[aria-haspopup]') as HTMLButtonElement).click();
    fixture.detectChanges();
    return document.querySelector('.mat-mdc-menu-panel') as HTMLElement;
  }

  it('offers "change password" to a regular account', async () => {
    const menu = await openMenuAs('another-id');
    expect(menu.querySelector('a[href="/change-password"]')).not.toBeNull();
  });

  it('hides "change password" from the demo account', async () => {
    const menu = await openMenuAs(environment.demoUserId);
    expect(menu.querySelector('a[href="/change-password"]')).toBeNull();
    expect(menu.querySelector('a[href="/bookmarks"]')).not.toBeNull(); // the rest of the menu is intact
  });
});

describe('Navbar layout', () => {
  it('puts the brand first and the actions last in DOM order, so RTL mirrors it', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([]), provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();
    const fixture = TestBed.createComponent(Navbar);
    await fixture.whenStable();
    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;
    const [first, last] = [nav.firstElementChild, nav.lastElementChild];
    expect(first?.textContent).toContain('navbar.brand');
    expect(last?.querySelector('button[mat-icon-button]')).not.toBeNull();
  });
});
