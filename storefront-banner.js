import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const hero = document.getElementById("homeHero");

if (hero) {
  db.from("site_banners")
    .select("background_image_url,is_active")
    .eq("id", "home")
    .maybeSingle()
    .then(({ data, error }) => {
      if (error || !data) return;
      if (data.is_active === false) {
        hero.hidden = true;
        return;
      }

      hero.hidden = false;
      const imageUrl = data.background_image_url;
      const eyebrow = document.getElementById("homeHeroEyebrow");
      const title = document.getElementById("homeHeroTitle");
      const description = document.getElementById("homeHeroDescription");
      const cta = document.getElementById("homeHeroCta");

      if (imageUrl) {
        [eyebrow, title, description, cta].forEach(node => {
          if (node) node.hidden = true;
        });
        let image = document.getElementById("homeHeroBannerImage");
        if (!image) {
          image = document.createElement("img");
          image.id = "homeHeroBannerImage";
          image.alt = "Banner utama Bos Pangan";
          image.loading = "eager";
          image.decoding = "async";
          hero.prepend(image);
        }
        image.src = imageUrl;
        image.style.cssText = "display:block;width:100%;height:auto;max-height:560px;object-fit:cover;border-radius:inherit;";
        hero.style.setProperty("padding", "0", "important");
        hero.style.setProperty("overflow", "hidden", "important");
        hero.style.setProperty("background", "transparent", "important");
        hero.style.setProperty("border", "0", "important");
      }
    })
    .catch(error => console.error("Bos Pangan banner:", error));
}
