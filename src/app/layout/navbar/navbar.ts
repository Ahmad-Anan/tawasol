import { Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ThemeService } from '../../core/services/theme';
import { LanguageService } from '../../core/services/language';

@Component({
  selector: 'app-navbar',
  imports: [MatIconButton, MatIcon, TranslatePipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  protected readonly themeService = inject(ThemeService);
  protected readonly languageService = inject(LanguageService);
}
