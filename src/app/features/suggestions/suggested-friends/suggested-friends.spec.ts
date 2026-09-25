import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { API_BASE_URL } from '../../../core/constants/api';
import { SuggestedFriends } from './suggested-friends';

const suggestion = (id: string, name: string) => ({
  _id: id,
  name,
  username: id,
  photo: `https://example.com/${id}.png`,
  mutualFollowersCount: 0,
  followersCount: 10,
});

describe('SuggestedFriends follow/unfollow', () => {
  let fixture: ComponentFixture<SuggestedFriends>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuggestedFriends],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SuggestedFriends);
    fixture.detectChanges();
    TestBed.tick();
    // No `nextPage`: a single page, so no infinite-scroll sentinel (jsdom has no IntersectionObserver).
    httpMock
      .expectOne((req) => req.url === `${API_BASE_URL}/users/suggestions`)
      .flush({
        success: true,
        message: 'ok',
        data: { suggestions: [suggestion('u1', 'Mona'), suggestion('u2', 'Omar')] },
        meta: { pagination: { currentPage: 1, limit: 10, total: 2, numberOfPages: 1 } },
      });
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
  });

  const rows = (): HTMLLIElement[] => [...fixture.nativeElement.querySelectorAll('li')];
  const followButtonOf = (index: number): HTMLButtonElement =>
    rows()[index].querySelector('app-follow-button button')!;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('keeps a followed user in the list, now showing "Following", so it can be undone', async () => {
    followButtonOf(0).click();
    httpMock
      .expectOne(`${API_BASE_URL}/users/u1/follow`)
      .flush({ success: true, message: 'success', data: { following: true, followersCount: 11 } });
    await settle();

    expect(rows().length).toBe(2);
    expect(rows()[0].textContent).toContain('Mona');
    expect(followButtonOf(0).textContent).toContain('shared.follow.following');
  });

  it('can unfollow right away from the same row, after confirming', async () => {
    followButtonOf(0).click();
    httpMock
      .expectOne(`${API_BASE_URL}/users/u1/follow`)
      .flush({ success: true, message: 'success', data: { following: true, followersCount: 11 } });
    await settle();

    followButtonOf(0).click();
    await settle();
    const confirm = [
      ...document.querySelectorAll<HTMLButtonElement>('app-unfollow-confirm-dialog button'),
    ].find((b) => b.textContent?.includes('shared.follow.confirm'))!;
    confirm.click();
    await settle();

    (await vi.waitFor(() => httpMock.expectOne(`${API_BASE_URL}/users/u1/follow`))).flush({
      success: true,
      message: 'success',
      data: { following: false, followersCount: 10 },
    });
    await settle();
    expect(followButtonOf(0).textContent).not.toContain('shared.follow.following');
  });

  it('rolls a failed follow back and names who could not be followed', async () => {
    followButtonOf(1).click();
    httpMock
      .expectOne(`${API_BASE_URL}/users/u2/follow`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(followButtonOf(1).textContent).not.toContain('shared.follow.following');
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('shared.follow.errors.followFailed');
  });
});
