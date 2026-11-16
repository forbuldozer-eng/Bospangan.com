import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const hero = document.getElementById("homeHero");
if (hero) {
  db.from("site_banners").select("eyebrow,title,description,cta_label,cta_url,background_color,background_image_url,is_active").eq("id","home").maybeSingle()
    .then(({data,error}) => {
      if (error || !data) return;\n      if (data.is_active === false) { hero.hidden = true; return; }\n      hero.hidden = false;
      const eyebrow = document.getElementById("homeHeroEyebrow");
      const title = document.getElementById("homeHeroTitle");
      const description = document.getElementById("homeHeroDescription");
      const cta = document.getElementById("homeHeroCta");
      if (eyebrow) eyebrow.textContent = data.eyebrow || "";
      if (title) { title.textContent = data.title || ""; title.style.whiteSpace = "pre-line"; }
      if (description) description.textContent = data.description || "";
      if (cta) {
        cta.textContent = data.cta_label || "Lihat katalog";
        cta.href = data.cta_url || "/#katalog";
        cta.hidden = !data.cta_label;
      }
      hero.style.setProperty("background-color", data.background_color || "#cf1b1d", "important");
      if (data.background_image_url) {
        const safeUrl = new URL(data.background_image_url, location.origin);
        if (safeUrl.protocol === "https:" || safeUrl.origin === location.origin) {
          hero.style.setProperty("background-image", "linear-gradient(90deg,rgba(0,0,0,.48),rgba(0,0,0,.08)),url('" + safeUrl.href.replace(/['()\\]/g,"") + "')", "important");
          hero.style.setProperty("background-position", "center", "important");
          hero.style.setProperty("background-size", "cover", "important");
        }
      } else {
        hero.style.setProperty("background-image", "none", "important");
      }
    })
    .catch(error => console.error("Bos Pangan banner:",error));
}
