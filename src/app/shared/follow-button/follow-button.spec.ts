import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { API_BASE_URL } from '../../core/constants/api';
import { FollowService } from '../../core/services/follow';
import { FollowButton } from './follow-button';

const FOLLOW_URL = `${API_BASE_URL}/users/u1/follow`;
const ok = (following: boolean) => ({
  success: true,
  message: 'success',
  data: { following, followersCount: 1 },
});

describe('FollowButton', () => {
  let fixture: ComponentFixture<FollowButton>;
  let httpMock: HttpTestingController;
  let followService: FollowService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FollowButton],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    followService = TestBed.inject(FollowService);
    fixture = TestBed.createComponent(FollowButton);
    fixture.componentRef.setInput('userId', 'u1');
    fixture.componentRef.setInput('name', 'Mona');
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
  });

  const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');
  const dialog = (): HTMLElement | null => document.querySelector('app-unfollow-confirm-dialog');
  const dialogButton = (key: string): HTMLButtonElement =>
    [...document.querySelectorAll<HTMLButtonElement>('app-unfollow-confirm-dialog button')].find(
      (b) => b.textContent?.includes(key),
    )!;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function startFollowing(): Promise<void> {
    followService.seed('u1', true);
    fixture.detectChanges();
  }

  describe('when not following', () => {
    it('reads "Follow", labelled with the name', () => {
      expect(button().textContent).toContain('shared.follow.follow');
      expect(button().getAttribute('aria-label')).toContain('shared.follow.followAriaLabel');
    });

    it('follows straight away (no confirmation) and turns into "Following ✓" optimistically', () => {
      button().click();
      fixture.detectChanges();

      expect(dialog()).toBeNull();
      expect(button().textContent).toContain('shared.follow.following');
      expect(button().querySelector('mat-icon')?.textContent?.trim()).toBe('check');
      httpMock.expectOne(FOLLOW_URL).flush(ok(true));
    });

    it('keeps the same button element, so keyboard focus stays on it', () => {
      const before = button();
      before.click();
      fixture.detectChanges();
      expect(button()).toBe(before);
      httpMock.expectOne(FOLLOW_URL).flush(ok(true));
    });

    it('is disabled but still focusable while the request is in flight, and ignores clicks', () => {
      button().click();
      fixture.detectChanges();

      expect(button().getAttribute('aria-disabled')).toBe('true');
      expect(button().hasAttribute('disabled')).toBe(false);
      button().click(); // a double click
      fixture.detectChanges();

      httpMock.expectOne(FOLLOW_URL).flush(ok(true));
    });

    it('rolls back to "Follow" when the request fails', async () => {
      button().click();
      httpMock.expectOne(FOLLOW_URL).flush({}, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(button().textContent).toContain('shared.follow.follow');
      expect(button().textContent).not.toContain('shared.follow.following');
      expect(followService.failure('u1')).toBe('follow');
    });
  });

  describe('when following', () => {
    beforeEach(startFollowing);

    it('reads "Following" with a check, and offers "Unfollow" (shown on hover)', () => {
      expect(button().textContent).toContain('shared.follow.following');
      expect(button().querySelector('.follow-button__hover')?.textContent).toContain(
        'shared.follow.unfollow',
      );
      expect(button().getAttribute('aria-label')).toContain('shared.follow.followingAriaLabel');
    });

    it('asks "Unfollow {name}?" before doing anything', async () => {
      button().click();
      await settle();

      expect(dialog()?.textContent).toContain('shared.follow.confirmTitle');
      expect(document.querySelector('mat-dialog-container')?.getAttribute('role')).toBe(
        'alertdialog',
      );
      httpMock.expectNone(FOLLOW_URL);
    });

    it('keeps following when the confirmation is cancelled', async () => {
      button().click();
      await settle();
      dialogButton('shared.follow.cancel').click();
      await settle();

      httpMock.expectNone(FOLLOW_URL);
      expect(button().textContent).toContain('shared.follow.following');
    });

    it('unfollows once confirmed, back to "Follow"', async () => {
      button().click();
      await settle();
      dialogButton('shared.follow.confirm').click();
      await settle();

      (await vi.waitFor(() => httpMock.expectOne(FOLLOW_URL))).flush(ok(false));
      await settle();
      expect(button().textContent).toContain('shared.follow.follow');
      expect(button().textContent).not.toContain('shared.follow.following');
    });

    it('rolls back to "Following" when unfollowing fails', async () => {
      button().click();
      await settle();
      dialogButton('shared.follow.confirm').click();
      await settle();

      (await vi.waitFor(() => httpMock.expectOne(FOLLOW_URL))).flush(
        {},
        { status: 500, statusText: 'Server Error' },
      );
      await settle();
      expect(button().textContent).toContain('shared.follow.following');
      expect(followService.failure('u1')).toBe('unfollow');
    });
  });
});
