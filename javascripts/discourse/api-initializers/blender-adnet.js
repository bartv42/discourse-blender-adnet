import { apiInitializer } from "discourse/lib/api";
import BlenderInlineAds from "../components/blender-inline-ads";
import { isUserSuppressed } from "../lib/blender-adnet-api";

// Registreert de inline ads in de Glimmer post-stream.
// De timeline-ad wordt apart geregistreerd via de outlet-connector in
// connectors/timeline-controls-before/.
export default apiInitializer((api) => {
  if (isUserSuppressed(api.getCurrentUser())) {
    return;
  }

  // Rendert een BlenderInlineAds-component na elke post-article waarvoor
  // shouldRender true geeft (elke N-de post).
  api.renderAfterWrapperOutlet("post-article", BlenderInlineAds);
});
