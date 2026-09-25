import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../../core/constants/api';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from './profile.service';

function profileResponse(id: string) {
  return {
    success: true,
    message: 'ok',
    data: { user: { _id: id, name: `User ${id}` }, isFollowing: false },
  };
}

function postsResponse() {
  return { success: true, message: 'ok', data: { posts: [] }, meta: { pagination: { total: 0 } } };
}

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { isAuthenticated: () => true, user: () => ({ _id: 'me' }), token: () => null },
        },
      ],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('ignores a slower response for a profile the user already navigated away from', () => {
    service.load('a');
    const staleProfile = httpMock.expectOne(`${API_BASE_URL}/users/a/profile`);
    const stalePosts = httpMock.expectOne(`${API_BASE_URL}/users/a/posts`);

    service.load('b');
    expect(staleProfile.cancelled).toBe(true);
    expect(stalePosts.cancelled).toBe(true);

    httpMock.expectOne(`${API_BASE_URL}/users/b/profile`).flush(profileResponse('b'));
    httpMock.expectOne(`${API_BASE_URL}/users/b/posts`).flush(postsResponse());

    expect(service.profile()?._id).toBe('b');
    expect(service.isLoading()).toBe(false);
    expect(service.loadError()).toBe(false);
  });

  it('retries the last requested profile after a failure', () => {
    service.load('a');
    httpMock
      .expectOne(`${API_BASE_URL}/users/a/profile`)
      .flush(null, { status: 500, statusText: 'Server Error' });
    httpMock.expectOne(`${API_BASE_URL}/users/a/posts`);
    expect(service.loadError()).toBe(true);

    service.retryLoad();
    httpMock.expectOne(`${API_BASE_URL}/users/a/profile`).flush(profileResponse('a'));
    httpMock.expectOne(`${API_BASE_URL}/users/a/posts`).flush(postsResponse());

    expect(service.profile()?._id).toBe('a');
    expect(service.loadError()).toBe(false);
  });
});

describe('ProfileService on the demo account', () => {
  it('never uploads a new profile photo', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            user: () => ({ _id: environment.demoUserId }),
            token: () => null,
          },
        },
      ],
    });
    const service = TestBed.inject(ProfileService);
    const httpMock = TestBed.inject(HttpTestingController);

    await service.uploadPhoto(new File(['x'], 'a.png', { type: 'image/png' }));

    httpMock.expectNone(`${API_BASE_URL}/users/upload-photo`);
    httpMock.verify();
  });
});
