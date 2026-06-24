import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe } from "@ember/template";
import { fetchUniqueInlineAds } from "../lib/blender-adnet-api";

// Inline ad-blok dat na elke N-de post in de stream verschijnt.
// Geregistreerd via api.renderAfterWrapperOutlet("post-article", ...).
// shouldRender bepaalt op basis van het post_number óf dit blok rendert,
// zodat we niet langer DOM-elementen hoeven te tellen.
export default class BlenderInlineAds extends Component {
  static shouldRender(args) {
    if (typeof settings === "undefined" || !settings.inline_ads_enabled) {
      return false;
    }
    const frequency = settings.inline_ad_frequency;
    if (!(frequency > 0)) {
      return false;
    }
    const post = args.post;
    if (!post) {
      return false;
    }
    // Gebruik de positie in de volledige stream (alle post-ids in volgorde),
    // niet post_number — postnummers hebben gaten door verwijderde posts,
    // wat tot ads vlak bij elkaar leidt.
    const stream = post.topic?.postStream?.stream;
    let index = -1;
    if (stream && post.id != null) {
      index = stream.indexOf(post.id);
    }
    if (index < 0 && Number.isInteger(post.post_number)) {
      index = post.post_number - 1; // fallback
    }
    // Toon na elke N-de post (0-based index → +1).
    return index >= 0 && (index + 1) % frequency === 0;
  }

  @tracked ads = [];

  constructor() {
    super(...arguments);
    this.loadAds();
  }

  get count() {
    return window.innerWidth <= 600 ? 1 : 3;
  }

  get gridStyle() {
    const cols = this.ads.length;
    let style = `grid-template-columns: repeat(${cols}, minmax(0, 1fr));`;
    // Centreer het grid wanneer er minder dan 3 ads terugkomen (desktop).
    if (cols > 0 && cols < 3 && window.innerWidth > 600) {
      style += `max-width: ${Math.round((cols / 3) * 100)}%; margin: 0 auto;`;
    }
    return htmlSafe(style);
  }

  async loadAds() {
    try {
      const ads = await fetchUniqueInlineAds(this.count);
      if (!this.isDestroying && !this.isDestroyed) {
        this.ads = ads;
      }
    } catch (_) {
      // stil falen: geen ads tonen
    }
  }

  <template>
    {{#if this.ads.length}}
      <div class="blender-friends-inline-wrapper">
        <a
          class="blender-friends-inline-pill"
          href="https://friends.blendernation.com/"
          target="_blank"
          rel="noopener noreferrer"
        >Friends of Blender Artists</a>

        <div class="blender-friends-inline-grid" style={{this.gridStyle}}>
          {{#each this.ads as |ad|}}
            <a
              class="blender-friends-inline-card"
              href={{ad.click_url}}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                class="blender-friends-inline-image"
                referrerpolicy="no-referrer"
                src={{ad.image_url}}
                alt={{ad.product_name}}
                title={{ad.product_name}}
              />
              <span
                class="blender-friends-inline-label"
              >{{ad.product_name}}</span>
            </a>
          {{/each}}
        </div>
      </div>
    {{/if}}
  </template>
}
