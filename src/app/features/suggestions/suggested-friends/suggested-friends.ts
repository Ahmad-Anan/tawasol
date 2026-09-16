import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SuggestionsService } from '../services/suggestions.service';

/**
 * Sidebar widget for the feed page — people-you-may-know, each with a one-tap Follow. Not
 * routed; only ever embedded (see feed-page.html), hidden below the `lg` breakpoint like any
 * other sidebar (the navbar already covers navigation on mobile).
 */
@Component({
  selector: 'app-suggested-friends',
  imports: [NgOptimizedImage, MatButtonModule, MatProgressSpinnerModule, RouterLink, TranslatePipe],
  templateUrl: './suggested-friends.html',
  styleUrl: './suggested-friends.css',
})
export class SuggestedFriends {
  protected readonly suggestionsService = inject(SuggestionsService);

  constructor() {
    this.suggestionsService.start();
  }
}
