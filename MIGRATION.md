# Migratie naar Discourse 2026.6.0 (Glimmer Post Stream)

Deze theme component (`Blender AdNet 2026`) is geschreven voor een oudere Discourse-versie en
gebruikt API's en DOM-patronen die in 2026.6.0 niet meer betrouwbaar werken. Sinds eind 2025
draait Discourse volledig op de **Glimmer Post Stream**; het oude widget-systeem is verwijderd.

## Waarom de huidige code breekt

| Huidig patroon | Status in 2026.6.0 | Probleem |
|---|---|---|
| `api.decorateCooked(...)` | deprecated | Vervangen door `decorateCookedElement` / outlets |
| `insertAdjacentElement` / `insertBefore` voor ad-DOM | breekt | Glimmer re-rendert reactief + post-stream gebruikt cloaking/virtual scroll → geïnjecteerde siblings verdwijnen of dupliceren bij scrollen |
| `querySelectorAll(".cooked")` indexeren | onbetrouwbaar | Niet alle posts staan tegelijk in de DOM (cloaking) → `% INLINE_FREQUENCY` klopt niet |
| Timeline `insertBefore` + `--blender-ad-height` CSS-hack | fragiel | Leunt op oude timeline-DOM; zelfde DOM-overlevingsrisico |
| `withPluginApi("0.8", ...)` | verouderd | Moderne vorm mag zonder versiestring |

`onPageChange`, `getCurrentUser` en de suppressie-logica zijn **niet** deprecated.

## Bevestigde nieuwe API's

### Inline ads (na elke N-de post)
```js
api.renderAfterWrapperOutlet("post-article", ComponentClass);
```
- `ComponentClass extends @glimmer/component`, met `static shouldRender(args)` en een `<template>`.
- `args.post.post_number` geeft het échte postnummer → geen DOM-telling meer nodig.
- Ember beheert de lifecycle → geen handmatige DOM, geen duplicaten, automatische cleanup.

### Timeline-ad
Bevestigd uit `frontend/discourse/app/components/topic-timeline/container.gjs`. Twee outlets:

| Outlet | Positie | `@outletArgs` |
|---|---|---|
| `timeline-controls-before` | in `.timeline-controls`, **boven** de scroll-area | `{ model }` |
| `timeline-footer-controls-after` | onderaan, na de footer-knoppen | `{ model, fullscreen }` |

→ **`timeline-controls-before`** is de plek voor de sidebar-ad (bovenin de timeline).
Geïmplementeerd als outlet-**connector**.

### Meevaller
Door de timeline-ad als connector te renderen:
- `--blender-ad-height` + `max-height !important`-hack vervalt (ad zit in normale flow).
- De hele `onPageChange`-blok vervalt (connector mount/unmount automatisch per topic).
- `updateHeightVar` vervalt.

## Doel-bestandsstructuur

`.gjs` is nodig voor `<template>`-syntax.

```
javascripts/discourse/
  lib/blender-adnet-api.js                                       ← fetch + extractKeywords + suppressie (plain JS, herbruikbaar)
  connectors/timeline-controls-before/blender-timeline-ad.gjs    ← timeline-ad
  api-initializers/blender-adnet.gjs                             ← renderAfterWrapperOutlet voor inline ads + suppressie-guard
```

## Stappen

1. **Logica isoleren** — `extractKeywords`, `fetchAd`, `fetchAdInline`, `fetchUniqueInlineAds`,
   `isUserSuppressed` verhuizen ongewijzigd naar `lib/blender-adnet-api.js`. Settings via `settings.*`.
2. **Inline ads** (hoogste risico) — `api.renderAfterWrapperOutlet("post-article", …)` met
   `shouldRender` op `post_number % inline_ad_frequency === 0`. Async fetch verhuist *in* de component
   (tracked). `injectInlineAds`-DOM wordt het `<template>`-blok; "minder dan 3 ads centreren" wordt een class.
3. **Timeline-ad** — connector op `timeline-controls-before`; `@outletArgs.model` voor keyword-extractie;
   fetch in de component. `onPageChange`/`injectAd`/`updateHeightVar` worden verwijderd.
4. **SCSS opschonen** — `--blender-ad-height` + `max-height`-override verwijderen; inline-grid-styling blijft.

## Architectuur-aandachtspunten

- Async ad-fetch verhuist in de componenten (tracked async; `fetchUniqueInlineAds`-exclude-loop blijft bruikbaar).
- `withPluginApi` mag zonder versiestring; in een `api-initializer` is `api` al gebonden.

## Bronnen

- [topic-timeline/container.gjs](https://github.com/discourse/discourse/blob/main/frontend/discourse/app/components/topic-timeline/container.gjs)
- [Upcoming post stream changes – How to prepare themes and plugins](https://meta.discourse.org/t/upcoming-post-stream-changes-how-to-prepare-themes-and-plugins/372063)
- [Using Plugin Outlet Connectors from a Theme or Plugin](https://meta.discourse.org/t/using-plugin-outlet-connectors-from-a-theme-or-plugin/32727)
