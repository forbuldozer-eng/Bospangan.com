import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const hero = document.getElementById("homeHero");

if (hero) {
  db.from("site_banners")
    .select("background_image_url,description,cta_label,cta_url,is_active")
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
      const oldDescription = document.getElementById("homeHeroDescription");
      const oldCta = document.getElementById("homeHeroCta");

      if (imageUrl) {
        [eyebrow, title, oldDescription, oldCta].forEach(node => {
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

        let content = document.getElementById("homeHeroBannerContent");
        if (!content) {
          content = document.createElement("div");
          content.id = "homeHeroBannerContent";
          content.style.cssText = "position:absolute;left:clamp(20px,6vw,72px);right:clamp(20px,6vw,72px);bottom:clamp(20px,5vw,56px);z-index:2;max-width:760px;color:#fff;text-shadow:0 1px 5px rgba(0,0,0,.55)";
          hero.append(content);
        }
        hero.style.setProperty("position", "relative", "important");
        hero.style.setProperty("padding", "0", "important");
        hero.style.setProperty("overflow", "hidden", "important");
        hero.style.setProperty("background", "#173b27", "important");
        hero.style.setProperty("border", "0", "important");
        hero.style.setProperty("isolation", "isolate", "important");

        let description = content.querySelector(".home-banner-description");
        if (!description) {
          description = document.createElement("p");
          description.className = "home-banner-description";
          description.style.cssText = "font-size:clamp(15px,2vw,22px);line-height:1.5;margin:0 0 16px;max-width:650px";
          content.append(description);
        }
        description.textContent = data.description || "";
        description.hidden = !data.description;

        let cta = content.querySelector(".home-banner-cta");
        if (!cta) {
          cta = document.createElement("a");
          cta.className = "home-banner-cta";
          cta.style.cssText = "display:inline-flex;align-items:center;justify-content:center;padding:11px 20px;border-radius:999px;background:#fff;color:#14532d;font-weight:800;text-decoration:none;text-shadow:none";
          content.append(cta);
        }
        cta.textContent = data.cta_label || "";
        cta.href = data.cta_url || "/#katalog";
        cta.hidden = !data.cta_label;
        cta.rel = cta.href.startsWith("http") ? "noopener noreferrer" : "";
        if (cta.href.startsWith("http")) cta.target = "_blank";
        else cta.removeAttribute("target");
        content.hidden = !data.description && !data.cta_label;
      }
    })
    .catch(error => console.error("Bos Pangan banner:", error));
}
