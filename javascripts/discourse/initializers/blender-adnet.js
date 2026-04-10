import { withPluginApi } from "discourse/lib/plugin-api";
import { schedule } from "@ember/runloop";

const PUBLISHER_ID =
  typeof settings !== "undefined" ? settings.publisher_id : 2;
const AD_CATEGORY =
  typeof settings !== "undefined" ? settings.ad_category : "";
const INLINE_ENABLED =
  typeof settings !== "undefined" ? settings.inline_ads_enabled : true;
const INLINE_FREQUENCY =
  typeof settings !== "undefined" ? settings.inline_ad_frequency : 10;

const TIMELINE_SELECTOR = [
  ".topic-timeline-container",
  ".timeline-container",
  ".topic-timeline",
].join(", ");

const STOP = new Set(['the','a','an','and','or','of','to','in','for','on','with',
                      'how','why','what','is','are','was','were','be','been',
                      'blender','tutorial','part','free','new']);

function extractKeywords(title) {
  title = title.replace(/[\|–\-—].+$/, '').trim().toLowerCase();
  title = title.replace(/[^a-z0-9 ]/g, ' ');
  return title.split(/\s+/)
    .filter(w => w.length >= 3 && !STOP.has(w))
    .slice(0, 5)
    .join('+');
}

function fetchAd() {
  let url = `https://friends.blendernation.com/api/v1/ad?publisher_id=${encodeURIComponent(PUBLISHER_ID)}&slot=sidebar`;
  if (AD_CATEGORY) {
    url += `&category=${encodeURIComponent(AD_CATEGORY)}`;
  }
  const kw = extractKeywords(document.title);
  if (kw) {
    url += `&kw=${kw}`;
  }
  return fetch(url, { credentials: "omit" }).then((r) => r.json());
}

function fetchAdInline() {
  let url = `https://friends.blendernation.com/api/v1/ad?publisher_id=${encodeURIComponent(PUBLISHER_ID)}&slot=in-stream`;
  if (AD_CATEGORY) {
    url += `&category=${encodeURIComponent(AD_CATEGORY)}`;
  }
  const kw = extractKeywords(document.title);
  if (kw) {
    url += `&kw=${kw}`;
  }
  return fetch(url, { credentials: "omit" }).then((r) => r.json());
}

function injectAd(ad) {
  const timeline = document.querySelector(TIMELINE_SELECTOR);
  if (!timeline) return;

  const wrapper = document.createElement("div");
  wrapper.className = "blender-friends-wrapper";

  const link = document.createElement("a");
  link.className = "blender-friends-link";
  link.href = ad.click_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const img = document.createElement("img");
  img.className = "blender-friends-image";
  img.src = ad.image_url;
  img.alt = ad.product_name;
  img.title = ad.product_name;
  img.addEventListener("load", () => updateHeightVar(wrapper), { once: true });

  const label = document.createElement("span");
  label.className = "blender-friends-label";
  label.textContent = ad.product_name;

  link.append(img, label);
  wrapper.append(link);
  timeline.parentNode.insertBefore(wrapper, timeline);

  updateHeightVar(wrapper);
}

function injectInlineAds(ads, postContainer) {
  const wrapper = document.createElement("div");
  wrapper.className = "blender-friends-inline-wrapper";

  const pill = document.createElement("a");
  pill.className = "blender-friends-inline-pill";
  pill.href = "https://friends.blendernation.com/";
  pill.target = "_blank";
  pill.rel = "noopener noreferrer";
  pill.textContent = "Friends of Blender Artists";
  wrapper.appendChild(pill);

  const grid = document.createElement("div");
  grid.className = "blender-friends-inline-grid";

  ads.forEach((ad) => {
    const card = document.createElement("a");
    card.className = "blender-friends-inline-card";
    card.href = ad.click_url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const img = document.createElement("img");
    img.className = "blender-friends-inline-image";
    img.loading = "lazy";
    img.src = ad.image_url;
    img.alt = ad.product_name;
    img.title = ad.product_name;

    const label = document.createElement("span");
    label.className = "blender-friends-inline-label";
    label.textContent = ad.product_name;

    card.append(img, label);
    grid.appendChild(card);
  });

  wrapper.appendChild(grid);
  postContainer.insertAdjacentElement("afterend", wrapper);
}

function updateHeightVar(el) {
  const height = el ? el.offsetHeight : 0;
  document.documentElement.style.setProperty(
    "--blender-ad-height",
    `${height}px`
  );
}

export default {
  name: "blender-friends",

  initialize() {
    withPluginApi("0.8", (api) => {
      api.onPageChange(() => {
        document
          .querySelectorAll(".blender-friends-wrapper")
          .forEach((el) => el.remove());
        document.documentElement.style.setProperty(
          "--blender-ad-height",
          "0px"
        );

        schedule("afterRender", () => {
          fetchAd()
            .then((data) => {
              if (!data.error) injectAd(data);
            })
            .catch(() => {});
        });
      });

      if (INLINE_ENABLED) {
        api.decorateCooked((element) => {
          const el = element instanceof Element ? element : element?.[0];
          if (!el) return;

          schedule("afterRender", () => {
            const allCooked = Array.from(document.querySelectorAll(".cooked"));
            const index = allCooked.indexOf(el) + 1;
            if (index <= 0 || index % INLINE_FREQUENCY !== 0) return;

            const postContainer =
              el.closest("article") ||
              el.closest(".topic-post") ||
              el.parentElement;
            if (!postContainer) return;

            if (
              postContainer.nextElementSibling?.classList.contains(
                "blender-friends-inline-wrapper"
              )
            )
              return;

            const count = window.innerWidth <= 600 ? 1 : 2;
            const fetches = Array.from({ length: count }, () => fetchAdInline());

            Promise.all(fetches)
              .then((results) => {
                const ads = results.filter((d) => !d.error);
                if (ads.length === 0) return;
                injectInlineAds(ads, postContainer);
              })
              .catch(() => {});
          });
        }, { id: "blender-friends-inline" });
      }
    });
  },
};
