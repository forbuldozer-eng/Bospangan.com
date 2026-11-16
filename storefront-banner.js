import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const hero = document.getElementById("homeHero");

function setBannerTextSize(node) {
  if (!node) return;
  // Match the main banner headline scale (index.html h1: clamp(36px, 6vw, 76px)).
  node.style.setProperty("font", "700 clamp(36px, 6vw, 76px)/1.02 Georgia,serif", "important");
  node.style.setProperty("letter-spacing", "-.06em", "important");
  node.style.setProperty("line-height", "1.02", "important");
  node.style.setProperty("max-width", "100%", "important");
}

function setCta(node, label, url) {
  if (!node) return;
  node.textContent = label || "";
  node.href = url || "/#katalog";
  node.hidden = !label;
  node.rel = node.href.startsWith("http") ? "noopener noreferrer" : "";
  if (node.href.startsWith("http")) node.target = "_blank";
  else node.removeAttribute("target");
}

async function renderHomepageBanner() {
  if (!hero) return;

  const { data, error } = await db.from("site_banners")
    .select("background_image_url,description,cta_label,cta_url,background_color,is_active")
    .eq("id", "home")
    .maybeSingle();

  if (error) {
    console.error("Bos Pangan banner:", error);
    return;
  }
  if (!data) return;

  if (data.is_active === false) {
    hero.hidden = true;
    return;
  }
  hero.hidden = false;

  const eyebrow = document.getElementById("homeHeroEyebrow");
  const title = document.getElementById("homeHeroTitle");
  const defaultDescription = document.getElementById("homeHeroDescription");
  const defaultCta = document.getElementById("homeHeroCta");
  const imageUrl = data.background_image_url || "";

  // Remove any previous dynamic image/overlay before applying the latest settings.
  document.getElementById("homeHeroBannerImage")?.remove();
  document.getElementById("homeHeroBannerContent")?.remove();

  if (imageUrl) {
    [eyebrow, title, defaultDescription, defaultCta].forEach(node => {
      if (node) node.hidden = true;
    });

    const image = document.createElement("img");
    image.id = "homeHeroBannerImage";
    image.alt = "Banner utama Bos Pangan";
    image.loading = "eager";
    image.decoding = "async";
    image.src = imageUrl;
    image.style.cssText = "display:block;width:100%;height:auto;min-height:360px;max-height:560px;object-fit:cover;object-position:center;border-radius:inherit;";
    hero.prepend(image);

    const content = document.createElement("div");
    content.id = "homeHeroBannerContent";
    content.style.cssText = "position:absolute;left:clamp(20px,6vw,72px);right:clamp(20px,6vw,72px);bottom:clamp(20px,5vw,56px);z-index:2;max-width:1100px;color:#fff;text-shadow:0 1px 5px rgba(0,0,0,.55)";
    hero.append(content);

    if (data.description) {
      const description = document.createElement("p");
      description.className = "home-banner-description";
      description.textContent = data.description;
      description.style.setProperty("font", "700 clamp(36px, 6vw, 76px)/1.02 Georgia,serif", "important");
      description.style.setProperty("letter-spacing", "-.06em", "important");
      description.style.setProperty("line-height", "1.02", "important");
      description.style.setProperty("max-width", "100%", "important");
      description.style.setProperty("margin", "0 0 18px", "important");
      content.append(description);
    }

    if (data.cta_label) {
      const cta = document.createElement("a");
      cta.className = "home-banner-cta";
      cta.style.cssText = "display:inline-flex;align-items:center;justify-content:center;padding:11px 20px;border-radius:999px;background:#fff;color:#14532d;font-weight:800;text-decoration:none;text-shadow:none";
      setCta(cta, data.cta_label, data.cta_url);
      content.append(cta);
    }
    content.hidden = !data.description && !data.cta_label;
    hero.style.setProperty("position", "relative", "important");
    hero.style.setProperty("padding", "0", "important");
    hero.style.setProperty("overflow", "hidden", "important");
    hero.style.setProperty("background", data.background_color || "#173b27", "important");
    hero.style.setProperty("border", "0", "important");
    hero.style.setProperty("isolation", "isolate", "important");
    return;
  }

  // Text and CTA must still update when the administrator uses the existing
  // colored homepage banner without uploading a background image.
  hero.style.removeProperty("position");
  hero.style.removeProperty("padding");
  hero.style.removeProperty("overflow");
  hero.style.removeProperty("isolation");
  hero.style.setProperty("background", data.background_color || "#cf1b1d", "important");
  hero.style.setProperty("background-image", "none", "important");
  hero.style.setProperty("color", "#fff", "important");

  [eyebrow, title, defaultDescription, defaultCta].forEach(node => {
    if (node) node.hidden = false;
  });

  if (defaultDescription) {
    defaultDescription.textContent = data.description || "";
    defaultDescription.hidden = !data.description;
    setBannerTextSize(defaultDescription);
  }
  setCta(defaultCta, data.cta_label, data.cta_url);
  [eyebrow, title, defaultDescription, defaultCta].forEach(node => {
    if (node) node.style.setProperty("color", "#fff", "important");
  });
}

renderHomepageBanner().catch(error => console.error("Bos Pangan banner:", error));
