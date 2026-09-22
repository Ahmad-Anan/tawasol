import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { Login } from '../login/login';
import { Register } from '../register/register';

@Component({
  selector: 'app-auth-shell',
  imports: [MatTabsModule, TranslatePipe, Login, Register],
  templateUrl: './auth-shell.html',
  styleUrl: './auth-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthShell {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly currentTab = toSignal(
    this.route.data.pipe(map((data) => (data['tab'] as 'login' | 'register') ?? 'login')),
    { initialValue: (this.route.snapshot.data['tab'] as 'login' | 'register') ?? 'login' },
  );

  protected readonly selectedIndex = computed(() => (this.currentTab() === 'register' ? 1 : 0));

  protected onTabChange(index: number): void {
    this.router.navigate(['/auth', index === 0 ? 'login' : 'register']);
  }
}
