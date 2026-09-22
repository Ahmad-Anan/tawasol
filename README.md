# Tawasol

A LinkedIn-style social media web app — feed, posts, comments, likes, bookmarks, notifications, friend suggestions, and profiles — built on Angular's zoneless, signals-first stack with a bespoke "Harbor & connection" visual identity.

**Live demo:** [tawasol-two.vercel.app](https://tawasol-two.vercel.app)

---

## Overview

Tawasol is a full-featured social feed application consuming the public [Route Posts API](https://route-posts.routemisr.com). It covers the core loop of a social platform — authenticate, post, react, comment, bookmark, follow suggestions, and get notified — wrapped in a custom design system rather than an off-the-shelf theme.

The app is built as a showcase of modern Angular practice: standalone components, Signals for all state, zoneless change detection, `inject()`-only dependency injection, and `rxResource()` for async data fetching instead of manual subscription management.

## Features

- **Authentication** — email/password login and registration, route guarding via `authGuard`, token-based session handling with an HTTP interceptor
- **Feed** — infinite-scrolling post feed, post creation, likes, a dedicated "who liked this" dialog
- **Comments** — threaded comments with replies, a comment composer, and reply lists per comment
- **Post detail** — a focused single-post view reachable at `/posts/:id`
- **Profile** — per-user profile pages at `/profile/:id` with a header and post history, skeleton loading states
- **Bookmarks** — save and revisit posts
- **Notifications** — a dedicated notifications feed with per-item read state
- **Friend suggestions** — a suggested-friends list and dialog
- **Account** — change-password flow
- **Dark mode** — toggled via a `.tawasol-dark` class, animated with the View Transitions API (`startViewTransition()`)
- **Internationalization** — runtime English (LTR) / Arabic (RTL) switching, English by default, with per-feature translation namespaces
- **Accessibility** — semantic heading hierarchy across every page, ARIA-labeled status indicators, skeleton loaders instead of bare spinners

## Architecture highlights

| Area | Approach |
| --- | --- |
| Change detection | Zoneless (`provideZonelessChangeDetection()`), `ChangeDetectionStrategy.OnPush` on every component |
| State | Angular Signals throughout — no NgRx/RxJS state stores; `computed()` for derived state |
| Data fetching | `rxResource()` per feature service (feed, comments, bookmarks, notifications, suggestions) instead of manual `subscribe()`/teardown |
| Dependency injection | `inject()` function only — no constructor injection |
| Routing | Feature-based lazy loading (`loadChildren`) per route, guarded with a single `authGuard` |
| Forms | Reactive forms with Signal Forms adopted for new form work |
| Rendering | Server-side rendering (SSR) deployed on Vercel, with SSR-aware handling of `localStorage`-backed state (theme, language, auth token) |
| Styling | Tailwind CSS utility classes plus a custom design-token layer (colors, fonts) layered under Angular Material's theming system |
| i18n | `@ngx-translate/core` v18 (signal-based `currentLang`/`fallbackLang`), per-feature JSON translation files merged by namespace |
| Theming | `ThemeService` / `LanguageService` singletons mirror each other's pattern: computed signals, `effect()`-driven DOM sync, anti-flicker inline script in `index.html` |

## Tech stack

- **Framework:** Angular 22 — standalone components, Signals, zoneless change detection, `OnPush` by convention
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + Angular Material (custom-themed)
- **i18n:** `@ngx-translate/core` v18 + `@ngx-translate/http-loader` v18
- **Rendering:** Angular SSR (`@angular/ssr`), Express server, deployed on Vercel
- **Testing:** Vitest
- **Backend:** [Route Posts API](https://route-posts.routemisr.com) (external REST API)

## Getting started

### Prerequisites

- Node.js (see `package.json` / CI config for the version this project targets)
- npm

### Installation

```bash
npm ci
```

### Development server

```bash
npm start
```

Navigate to `http://localhost:4200/`. The app reloads automatically on source changes.

### Build

```bash
npm run build
```

Build artifacts are written to `dist/tawasol/`.

### Running the SSR server

```bash
npm run serve:ssr:tawasol
```

### Tests

```bash
npm test
```

## Project structure

```
src/app/
├── core/            # Singletons: services (auth, theme, language), guards, interceptors, constants
├── features/         # Feature modules, one folder per domain
│   ├── auth/          # Login, register, auth shell
│   ├── feed/           # Feed page, post card, post creation, likes dialog
│   ├── comments/       # Comment list, item, composer, replies
│   ├── post-detail/    # Single post view
│   ├── profile/        # Profile header + page
│   ├── bookmarks/      # Bookmarked posts
│   ├── notifications/  # Notifications feed
│   ├── suggestions/    # Suggested friends
│   └── change-password/
├── layout/           # App-shell chrome (navbar)
└── shared/           # Reusable presentational components (e.g. status-indicator) and interfaces
```

Each feature owns its own routes file (`*.routes.ts`) and is lazy-loaded from `app.routes.ts`. Translation files live under `public/i18n/<feature>/{en,ar}.json`, one namespace per feature.

## Author

**Ahmed Anan**

- GitHub: [github.com/Ahmad-Anan](https://github.com/Ahmad-Anan)
- LinkedIn: [linkedin.com/in/ahmed-anan-285364273](https://linkedin.com/in/ahmed-anan-285364273)
- Portfolio: [portfolio-one-navy-65.vercel.app](https://portfolio-one-navy-65.vercel.app)

---

<div dir="rtl">

# تواصل

تطبيق ويب للتواصل الاجتماعي على غرار LinkedIn — فيد، منشورات، تعليقات، إعجابات، محفوظات، إشعارات، اقتراحات أصدقاء، وملفات شخصية — مبني على استاك Angular الحديث القائم على الـ Signals وبدون Zone.js، بهوية بصرية خاصة باسم "Harbor & connection".

**رابط تجريبي مباشر:** [tawasol-two.vercel.app](https://tawasol-two.vercel.app)

---

## نظرة عامة

تواصل هو تطبيق فيد اجتماعي متكامل يستهلك [Route Posts API](https://route-posts.routemisr.com) العام. يغطي الحلقة الأساسية لأي منصة تواصل اجتماعي — تسجيل الدخول، النشر، التفاعل، التعليق، الحفظ، متابعة الاقتراحات، واستقبال الإشعارات — ضمن نظام تصميم مخصص بدلاً من قالب جاهز.

بُني التطبيق كعرض عملي لأحدث ممارسات Angular: كومبوننتس standalone، Signals لكل الحالة، Change Detection بدون Zone.js، حقن الاعتماديات عبر `inject()` فقط، واستخدام `rxResource()` لجلب البيانات غير المتزامنة بدلاً من إدارة الاشتراكات يدويًا.

## المميزات

- **المصادقة** — تسجيل دخول وتسجيل حساب بالبريد الإلكتروني وكلمة المرور، حماية المسارات عبر `authGuard`، وإدارة الجلسة بتوكن عبر HTTP interceptor
- **الفيد** — فيد منشورات بتمرير لا نهائي، إنشاء منشورات، إعجابات، ونافذة مخصصة لعرض من أعجب بالمنشور
- **التعليقات** — تعليقات متسلسلة بردود، أداة كتابة تعليق، وقوائم ردود لكل تعليق
- **تفاصيل المنشور** — عرض مخصص لمنشور واحد عبر `/posts/:id`
- **الملف الشخصي** — صفحات ملف شخصي لكل مستخدم عبر `/profile/:id` مع رأس صفحة وسجل منشورات، وحالات تحميل skeleton
- **المحفوظات** — حفظ المنشورات والرجوع إليها لاحقًا
- **الإشعارات** — فيد إشعارات مخصص بحالة قراءة لكل عنصر
- **اقتراحات الأصدقاء** — قائمة ونافذة لاقتراح أصدقاء جدد
- **الحساب** — تدفق تغيير كلمة المرور
- **الوضع الليلي** — يُفعّل عبر كلاس `.tawasol-dark` بانيميشن عبر View Transitions API (`startViewTransition()`)
- **تعدد اللغات** — تبديل وقت التشغيل بين الإنجليزية (LTR) والعربية (RTL)، الإنجليزية هي الافتراضي، مع ملفات ترجمة منفصلة لكل ميزة
- **إمكانية الوصول** — تسلسل عناوين semantic واضح في كل صفحة، مؤشرات حالة بسمات ARIA، واستخدام skeleton loaders بدلاً من مؤشرات تحميل عادية

## أبرز نقاط العمارة

| المجال | الأسلوب |
| --- | --- |
| Change Detection | بدون Zone.js (`provideZonelessChangeDetection()`)، و`ChangeDetectionStrategy.OnPush` على كل كومبوننت |
| الحالة (State) | Angular Signals في كل مكان — بدون NgRx أو مخازن حالة قائمة على RxJS؛ `computed()` للحالة المشتقة |
| جلب البيانات | `rxResource()` لكل خدمة ميزة (الفيد، التعليقات، المحفوظات، الإشعارات، الاقتراحات) بدلاً من `subscribe()` يدوي وتنظيف يدوي |
| حقن الاعتماديات | دالة `inject()` فقط — بدون حقن عبر الـ constructor |
| التوجيه (Routing) | تحميل كسول (`loadChildren`) لكل ميزة على حدة، محمي بحارس مصادقة واحد `authGuard` |
| النماذج | Reactive Forms، مع تبني Signal Forms للنماذج الجديدة |
| العرض (Rendering) | عرض من جانب الخادم (SSR) منشور على Vercel، مع معالجة تراعي SSR للحالة المعتمدة على `localStorage` (الثيم، اللغة، توكن المصادقة) |
| التنسيق (Styling) | كلاسات Tailwind CSS utility مع طبقة design tokens مخصصة (ألوان وخطوط) فوق نظام theming الخاص بـ Angular Material |
| تعدد اللغات | `@ngx-translate/core` الإصدار 18 (بإشارات `currentLang`/`fallbackLang`)، ملفات ترجمة JSON لكل ميزة تُدمج حسب namespace |
| الثيمنج | خدمتا `ThemeService` و`LanguageService` (singleton) تتبعان نفس النمط: computed signals، مزامنة الـ DOM عبر `effect()`، وسكربت مضمّن في `index.html` لمنع الوميض عند التحميل |

## التقنيات المستخدمة

- **الإطار:** Angular 22 — كومبوننتس standalone، Signals، بدون Zone.js، و`OnPush` كاتفاقية ثابتة
- **اللغة:** TypeScript
- **التنسيق:** Tailwind CSS v4 + Angular Material (بثيم مخصص)
- **تعدد اللغات:** `@ngx-translate/core` الإصدار 18 + `@ngx-translate/http-loader` الإصدار 18
- **العرض:** Angular SSR (`@angular/ssr`)، خادم Express، منشور على Vercel
- **الاختبارات:** Vitest
- **الخلفية (Backend):** [Route Posts API](https://route-posts.routemisr.com) (REST API خارجي)

## البدء السريع

### المتطلبات

- Node.js (راجع `package.json` أو إعدادات CI لمعرفة الإصدار المعتمد في المشروع)
- npm

### التثبيت

```bash
npm ci
```

### خادم التطوير

```bash
npm start
```

افتح `http://localhost:4200/` في المتصفح. يُعاد تحميل التطبيق تلقائيًا عند أي تعديل في الكود المصدري.

### البناء

```bash
npm run build
```

تُكتب مخرجات البناء في `dist/tawasol/`.

### تشغيل خادم SSR

```bash
npm run serve:ssr:tawasol
```

### الاختبارات

```bash
npm test
```

## بنية المشروع

```
src/app/
├── core/            # الخدمات الأساسية (المصادقة، الثيم، اللغة)، الحراس، الـ interceptors، الثوابت
├── features/         # وحدات الميزات، مجلد مستقل لكل مجال
│   ├── auth/          # تسجيل الدخول، التسجيل، غلاف المصادقة
│   ├── feed/           # صفحة الفيد، بطاقة المنشور، إنشاء منشور، نافذة الإعجابات
│   ├── comments/       # قائمة التعليقات، عنصر التعليق، أداة الكتابة، الردود
│   ├── post-detail/    # عرض منشور واحد
│   ├── profile/        # رأس الملف الشخصي + الصفحة
│   ├── bookmarks/      # المنشورات المحفوظة
│   ├── notifications/  # فيد الإشعارات
│   ├── suggestions/    # اقتراحات الأصدقاء
│   └── change-password/
├── layout/           # هيكل واجهة التطبيق (شريط التنقل)
└── shared/           # كومبوننتس عرض قابلة لإعادة الاستخدام (مثل status-indicator) والواجهات (interfaces)
```

يمتلك كل feature ملف مسارات خاص به (`*.routes.ts`) ويُحمَّل بشكل كسول من `app.routes.ts`. ملفات الترجمة موجودة تحت `public/i18n/<feature>/{en,ar}.json`، namespace منفصل لكل ميزة.

## المطوّر

**أحمد أنان**

- GitHub: [github.com/Ahmad-Anan](https://github.com/Ahmad-Anan)
- LinkedIn: [linkedin.com/in/ahmed-anan-285364273](https://linkedin.com/in/ahmed-anan-285364273)
- Portfolio: [portfolio-one-navy-65.vercel.app](https://portfolio-one-navy-65.vercel.app)

</div>
