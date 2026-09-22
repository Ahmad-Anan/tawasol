import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * The Harbor & connection brand's 8-point star (see AGENTS.md > Visual Identity), used as an
 * avatar's "online" status badge. `online` is a plain boolean today — there's no real-time
 * presence system yet, so callers pass a fixed value until one exists (e.g. the feed always
 * passes `true` for a post's author — see PostCard). This shape is reserved for that one
 * purpose; don't reuse it decoratively elsewhere.
 *
 * Positioned by the consumer: this component's host renders at its natural size with no
 * position of its own, so a caller placing it over an avatar corner applies its own
 * `absolute`/offset utility classes directly on `<app-status-indicator>`.
 */
@Component({
  selector: 'app-status-indicator',
  templateUrl: './status-indicator.html',
  styleUrl: './status-indicator.css',
  host: {
    role: 'img',
    '[class.status-indicator--online]': 'online()',
    '[class.status-indicator--offline]': '!online()',
    '[attr.aria-label]': 'ariaLabel()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusIndicator {
  private readonly translate = inject(TranslateService);

  readonly online = input(true);

  protected readonly ariaLabel = computed(
    () =>
      this.translate.translate(
        this.online() ? 'shared.statusIndicator.online' : 'shared.statusIndicator.offline',
      )() as string,
  );
}
