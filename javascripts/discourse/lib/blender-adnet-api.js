// Gedeelde logica voor de Blender AdNet theme component.
// Settings (`settings.*`) zijn globaal beschikbaar in theme-modules; we lezen ze
// per call zodat wijzigingen in de admin direct doorwerken zonder herladen.

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with",
  "how", "why", "what", "is", "are", "was", "were", "be", "been",
  "blender", "tutorial", "part", "free", "new",
]);

// Haal zoekwoorden uit een titel voor contextuele ad-targeting.
export function extractKeywords(title) {
  if (!title) {
    return "";
  }
  title = title.replace(/[\|–\-—].+$/, "").trim().toLowerCase();
  title = title.replace(/[^a-z0-9 ]/g, " ");
  return title
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .slice(0, 5)
    .join("+");
}

function buildUrl(slot, { exclude = [], title } = {}) {
  const publisherId =
    typeof settings !== "undefined" ? settings.publisher_id : 2;
  const adCategory = typeof settings !== "undefined" ? settings.ad_category : "";

  let url = `https://friends.blendernation.com/api/v1/ad?publisher_id=${encodeURIComponent(
    publisherId
  )}&slot=${encodeURIComponent(slot)}`;

  if (adCategory) {
    url += `&category=${encodeURIComponent(adCategory)}`;
  }

  const kw = extractKeywords(title ?? document.title);
  if (kw) {
    url += `&kw=${kw}`;
  }

  if (exclude.length) {
    url += `&exclude=${exclude.join(",")}`;
  }

  return url;
}

// Eén sidebar-ad (timeline), met optionele exclude-lijst van product_ids
// (gebruikt bij rotatie om een andere ad dan de huidige te krijgen).
export function fetchAd(title, exclude = []) {
  return fetch(buildUrl("sidebar", { title, exclude }), {
    credentials: "omit",
  }).then((r) => r.json());
}

// Eén in-stream ad, met optionele exclude-lijst van product_ids.
export function fetchAdInline(exclude = [], title) {
  return fetch(buildUrl("in-stream", { exclude, title }), {
    credentials: "omit",
  }).then((r) => r.json());
}

// Haal `count` unieke in-stream ads op, sequentieel met exclude-lijst.
export async function fetchUniqueInlineAds(count, title) {
  const ads = [];
  const seenIds = [];
  for (let i = 0; i < count; i++) {
    try {
      const data = await fetchAdInline(seenIds, title);
      if (data && !data.error && !seenIds.includes(data.product_id)) {
        ads.push(data);
        seenIds.push(data.product_id);
      }
    } catch (_) {
      // netwerk-error voor deze slot: ga door met wat we al hebben
    }
  }
  return ads;
}

// Bepaalt of ads verborgen moeten worden voor de huidige gebruiker.
export function isUserSuppressed(currentUser) {
  const suppressGroups =
    typeof settings !== "undefined" ? settings.suppress_for_groups : "";
  if (!suppressGroups) {
    return false;
  }
  if (!currentUser) {
    return false;
  }
  const suppressList = suppressGroups
    .split(/[|,]/)
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);
  const userGroups = (currentUser.groups || []).map((g) =>
    (g.name || "").toLowerCase()
  );
  return suppressList.some((g) => userGroups.includes(g));
}
