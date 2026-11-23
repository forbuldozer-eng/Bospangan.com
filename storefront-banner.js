import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const hero = document.getElementById("homeHero");

function applyDescription(node, value) {
  if (!node) return;
  node.textContent = value || "Bos Pangan menyediakan produk dan makanan bergizi nasional untuk memenuhi kebutuhan pangan masyarakat.";
  node.hidden = false;
  node.style.setProperty("font", "400 16px/1.5 system-ui,sans-serif", "important");
  node.style.setProperty("letter-spacing", "normal", "important");
  node.style.setProperty("line-height", "1.5", "important");
  node.style.setProperty("max-width", "65%", "important");
  node.style.setProperty("margin", "0 0 16px", "important");
  node.style.setProperty("color", "#fff", "important");
}

function applyCta(node, label, url) {
  if (!node) return;
  node.textContent = label || "Katalog kebutuhan harian";
  node.href = url || "/#katalog";
  node.hidden = false;
  node.className = "tag";
  node.style.setProperty("display", "inline-block", "important");
  node.style.setProperty("padding", "3px 10px", "important");
  node.style.setProperty("border", "1px solid rgba(255,255,255,.8)", "important");
  node.style.setProperty("border-radius", "30px", "important");
  node.style.setProperty("background", "transparent", "important");
  node.style.setProperty("color", "#fff", "important");
  node.style.setProperty("font", "400 12px/1.5 system-ui,sans-serif", "important");
  node.rel = node.href.startsWith("http") ? "noopener noreferrer" : "";
  if (node.href.startsWith("http")) node.target = "_blank";
  else node.removeAttribute("target");
}

function applyBannerImage(imageUrl) {
  if (!hero) return;
  // CMS image is the background of the existing hero; no second banner is created.
  if (imageUrl) {
    hero.style.setProperty("background-image",
      "linear-gradient(90deg, rgba(145,12,18,.88) 0%, rgba(145,12,18,.76) 48%, rgba(145,12,18,.28) 100%), url(" + JSON.stringify(imageUrl) + ")",
      "important");
    hero.style.setProperty("background-position", "center, center", "important");
    hero.style.setProperty("background-size", "cover, cover", "important");
    hero.style.setProperty("background-repeat", "no-repeat", "important");
  } else {
    hero.style.setProperty("background-image", "none", "important");
    hero.style.setProperty("background-color", "#cf1b1d", "important");
  }
}

async function renderHomepageBanner() {
  if (!hero) return;
  const eyebrow = document.getElementById("homeHeroEyebrow");
  const title = document.getElementById("homeHeroTitle");
  const description = document.getElementById("homeHeroDescription");
  const cta = document.getElementById("homeHeroCta");

  // Keep one original banner visible while the saved CMS values load.
  hero.hidden = false;
  hero.style.setProperty("background-color", "#cf1b1d", "important");
  hero.style.setProperty("color", "#fff", "important");
  hero.style.setProperty("position", "relative", "important");
  hero.style.setProperty("overflow", "hidden", "important");
  hero.style.setProperty("padding", "clamp(25px,5vw,66px)", "important");
  hero.style.setProperty("min-height", "360px", "important");
  hero.style.setProperty("border-radius", "22px", "important");

  if (eyebrow) {
    eyebrow.textContent = "BOS PANGAN / PANGAN BERGIZI NASIONAL";
    eyebrow.hidden = false;
    eyebrow.style.setProperty("color", "#fff", "important");
  }
  if (title) {
    title.hidden = false;
    title.textContent = "Menyediakan Produk dan Makanan Bergizi Nasional";
    title.style.setProperty("color", "#fff", "important");
  }
  applyDescription(description, description?.textContent);
  applyCta(cta, cta?.textContent, cta?.getAttribute("href"));

  try {
    const { data, error } = await db.from("site_banners")
      .select("background_image_url,description,cta_label,cta_url,is_active")
      .eq("id", "home")
      .maybeSingle();
    if (error) throw error;
    if (!data) return;
    if (data.is_active === false) { applyBannerImage(""); return; }
    applyBannerImage(data.background_image_url || "");
    applyDescription(description, data.description);
    applyCta(cta, data.cta_label, data.cta_url);
  } catch (error) {
    console.error("Bos Pangan banner:", error);
    // Keep the original red banner and default content if Supabase is unavailable.
  }
}

renderHomepageBanner();
