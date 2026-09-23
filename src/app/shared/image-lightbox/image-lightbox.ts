import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

export interface ImageLightboxData {
  src: string;
  /** Translation key for the image's alt text, e.g. `shared.imageLightbox.postImage`. */
  altKey: string;
}

/**
 * Full-size, view-only image overlay — no likes/comments/actions by design, just the image.
 *
 * The dialog panel is stretched to the full viewport (see `openImageLightbox`) and made
 * transparent via the global `.image-lightbox-panel`/`.image-lightbox-backdrop` rules in
 * styles.css (they target CDK overlay elements outside this component's view encapsulation).
 * That means a click on the "backdrop" actually lands on this component's own stage element,
 * so `onStageClick` closes on any click that isn't on the image itself. Escape is handled by
 * MatDialog's default `disableClose: false`.
 *
 * Plain `[src]` rather than `NgOptimizedImage`: `ngSrc` requires either fixed width/height or
 * `fill`, and neither allows "intrinsic size, capped to the viewport, aspect ratio preserved".
 * The URL is the same one the card thumbnail already loaded, so it's normally a cache hit.
 */
@Component({
  selector: 'app-image-lightbox',
  imports: [MatButtonModule, MatIcon, TranslatePipe],
  templateUrl: './image-lightbox.html',
  styleUrl: './image-lightbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageLightbox {
  protected readonly data = inject<ImageLightboxData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ImageLightbox>);

  protected close(): void {
    this.dialogRef.close();
  }

  protected onStageClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}

/** Shared by every "click an image to enlarge it" call site so they all get the same overlay config. */
export function openImageLightbox(
  dialog: MatDialog,
  translate: TranslateService,
  data: ImageLightboxData,
): void {
  dialog.open(ImageLightbox, {
    data,
    ariaLabel: translate.translate('shared.imageLightbox.dialogLabel')() as string,
    autoFocus: 'first-tabbable',
    width: '100vw',
    height: '100vh',
    maxWidth: '100vw',
    maxHeight: '100vh',
    panelClass: 'image-lightbox-panel',
    backdropClass: 'image-lightbox-backdrop',
  });
}
