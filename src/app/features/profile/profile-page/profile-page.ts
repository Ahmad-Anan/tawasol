import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { PostCard } from '../../feed/post-card/post-card';
import { ProfileHeader } from '../profile-header/profile-header';
import { ProfileHeaderSkeleton } from '../profile-header-skeleton/profile-header-skeleton';
import { ProfileService } from '../services/profile.service';

@Component({
  selector: 'app-profile-page',
  imports: [ProfileHeader, ProfileHeaderSkeleton, PostCard, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly profileService = inject(ProfileService);
  private readonly route = inject(ActivatedRoute);

  private readonly userId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    // Re-loads on every :id change, not just on first mount — Angular reuses this component
    // instance when navigating from one profile route straight to another (e.g. following a
    // link to a different author's profile), so a constructor-only load would leave the
    // previous profile on screen.
    effect(() => {
      const id = this.userId();
      if (id) {
        this.profileService.load(id);
      }
    });
  }
}
