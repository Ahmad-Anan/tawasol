import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { DemoAccountService } from '../../../core/services/demo-account';
import type { ProfileUser } from '../profile.interface';
import { ProfileService } from '../services/profile.service';
import { ProfileHeader } from './profile-header';

const profile: ProfileUser = {
  _id: 'me',
  id: 'me',
  name: 'Tawasol Demo',
  username: 'tawasol_demo',
  email: 'demo@example.com',
  photo: 'https://example.com/photo.png',
  cover: '',
  followersCount: 0,
  followingCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe("ProfileHeader on one's own profile", () => {
  let fixture: ComponentFixture<ProfileHeader>;
  let uploadPhoto: ReturnType<typeof vi.fn>;

  async function render(isDemo: boolean): Promise<HTMLElement> {
    uploadPhoto = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ProfileHeader],
      providers: [
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: DemoAccountService, useValue: { isDemo: signal(isDemo) } },
        {
          provide: ProfileService,
          useValue: {
            profile: signal(profile),
            isOwnProfile: () => true,
            isFollowing: () => false,
            isTogglingFollow: () => false,
            isUploadingPhoto: () => false,
            uploadError: () => false,
            followError: () => false,
            loadError: () => false,
            postsTotal: () => 0,
            bookmarksCount: () => 0,
            uploadPhoto,
            retryLoad: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileHeader);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const cameraButton = (el: HTMLElement): HTMLButtonElement =>
    el.querySelector('button[aria-label="profile.changePhoto"]')!;
  const editButton = (el: HTMLElement): HTMLButtonElement =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('profile.editProfile'))!;

  it('lets a regular account change its photo', async () => {
    const el = await render(false);
    expect(cameraButton(el).getAttribute('aria-disabled')).not.toBe('true');
    expect(editButton(el).getAttribute('aria-disabled')).not.toBe('true');
    expect(el.textContent).not.toContain('shared.demo.disabled');
  });

  describe('as the demo account', () => {
    it('disables both photo controls and shows the note', async () => {
      const el = await render(true);
      const note = el.querySelector('#profile-photo-demo-note');

      expect(note?.textContent).toContain('shared.demo.disabled');
      for (const button of [cameraButton(el), editButton(el)]) {
        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(button.getAttribute('aria-describedby')).toBe('profile-photo-demo-note');
      }
    });

    it('does not open the file picker when a disabled control is clicked', async () => {
      const el = await render(true);
      const picker: HTMLInputElement = el.querySelector('input[type="file"]')!;
      const openPicker = vi.spyOn(picker, 'click');

      cameraButton(el).click();
      editButton(el).click();
      expect(openPicker).not.toHaveBeenCalled();
    });

    it('never stages a picked file for upload', async () => {
      const el = await render(true);
      const picker: HTMLInputElement = el.querySelector('input[type="file"]')!;
      Object.defineProperty(picker, 'files', {
        value: [new File(['x'], 'a.png', { type: 'image/png' })],
      });
      picker.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(el.textContent).not.toContain('profile.photoPreviewHint');
      expect(uploadPhoto).not.toHaveBeenCalled();
    });
  });
});
