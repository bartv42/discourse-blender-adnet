import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { registerDestructor } from "@ember/destroyable";
import { service } from "@ember/service";
import { htmlSafe } from "@ember/template";
import { fetchAd, isUserSuppressed } from "../../lib/blender-adnet-api";

// Sidebar-ad boven de timeline-scrollarea.
// Geregistreerd via de outlet-connector op "timeline-controls-before".
// Vervangt de oude onPageChange + handmatige insertBefore + --blender-ad-height
// CSS-hack: de ad zit nu in de normale flow van .timeline-controls en de
// component mount/unmount automatisch per topic.
// Optioneel rouleert de ad op een interval (timeline_rotation_seconds): elke
// rotatie sluit de huidige ad uit zodat de server een andere teruggeeft —
// anders zou de browser dezelfde afbeelding uit cache halen en niet als nieuwe
// impressie tellen.
export default class BlenderTimelineAd extends Component {
  @service currentUser;

  @tracked ad = null;

  constructor() {
    super(...arguments);
    if (this.suppressed) {
      return;
    }
    this.loadAd();
    this.startRotation();
  }

  get suppressed() {
    return isUserSuppressed(this.currentUser);
  }

  get hoverEnabled() {
    return typeof settings !== "undefined"
      ? settings.timeline_hover_enabled
      : true;
  }

  // Geeft de configureerbare hover-schaal en -vertraging door aan de CSS via
  // custom properties. Schaal staat als percentage in de settings (160 = 1,6x).
  get hoverStyle() {
    const pct =
      typeof settings !== "undefined" ? settings.timeline_hover_scale_pct : 160;
    const delay =
      typeof settings !== "undefined" ? settings.timeline_hover_delay_ms : 150;
    const scale = (pct > 0 ? pct : 100) / 100;
    return htmlSafe(
      `--blender-hover-scale: ${scale}; --blender-hover-delay: ${delay}ms;`
    );
  }

  startRotation() {
    const seconds =
      typeof settings !== "undefined" ? settings.timeline_rotation_seconds : 0;
    if (!(seconds > 0)) {
      return;
    }
    const timer = setInterval(() => {
      const exclude = this.ad?.product_id != null ? [this.ad.product_id] : [];
      this.loadAd(exclude);
    }, seconds * 1000);
    registerDestructor(this, () => clearInterval(timer));
  }

  async loadAd(exclude = []) {
    try {
      const title = this.args.outletArgs?.model?.title;
      const data = await fetchAd(title, exclude);
      if (data && !data.error && !this.isDestroying && !this.isDestroyed) {
        this.ad = data;
      }
    } catch (_) {
      // stil falen: geen ad tonen
    }
  }

  <template>
    {{#if this.ad}}
      <div
        class="blender-friends-wrapper
          {{if this.hoverEnabled 'is-hoverable'}}"
        style={{this.hoverStyle}}
      >
        <a
          class="blender-friends-link"
          href={{this.ad.click_url}}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            class="blender-friends-image"
            referrerpolicy="no-referrer"
            src={{this.ad.image_url}}
            alt={{this.ad.product_name}}
          />
          <span class="blender-friends-label">{{this.ad.product_name}}</span>
        </a>
      </div>
    {{/if}}
  </template>
}
