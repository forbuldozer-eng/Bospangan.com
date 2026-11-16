import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const hero = document.getElementById("homeHero");

// Keep one stable banner structure. CMS controls only the supporting description
// and CTA; it must never replace the heading/breadcrumb or create a second overlay.
function applyDescription(node, value) {
  if (!node) return;
  node.textContent = value || "Temukan berbagai kebutuhan pangan dan produk harian dalam satu katalog.";
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
  node.style.setProperty("border", "1px solid rgba(255,255,255,.75)", "important");
  node.style.setProperty("border-radius", "30px", "important");
  node.style.setProperty("background", "transparent", "important");
  node.style.setProperty("color", "#fff", "important");
  node.style.setProperty("font", "400 12px/1.5 system-ui,sans-serif", "important");
  node.rel = node.href.startsWith("http") ? "noopener noreferrer" : "";
  if (node.href.startsWith("http")) node.target = "_blank";
  else node.removeAttribute("target");
}

async function renderHomepageBanner() {
  if (!hero) return;

  const eyebrow = document.getElementById("homeHeroEyebrow");
  const title = document.getElementById("homeHeroTitle");
  const description = document.getElementById("homeHeroDescription");
  const cta = document.getElementById("homeHeroCta");

  // Clean up overlays created by the previous banner implementation.
  document.getElementById("homeHeroBannerImage")?.remove();
  document.getElementById("homeHeroBannerContent")?.remove();

  // Restore the original, single red banner immediately and keep its breadcrumb.
  hero.hidden = false;
  hero.style.setProperty("background", "#cf1b1d", "important");
  hero.style.setProperty("background-image", "none", "important");
  hero.style.setProperty("color", "#fff", "important");
  hero.style.setProperty("position", "relative", "important");
  hero.style.setProperty("overflow", "hidden", "important");
  hero.style.setProperty("padding", "clamp(25px,5vw,66px)", "important");
  hero.style.setProperty("min-height", "360px", "important");
  hero.style.setProperty("border-radius", "22px", "important");
  hero.style.setProperty("isolation", "auto", "important");

  if (eyebrow) {
    eyebrow.innerHTML = "BEKASI &nbsp; / &nbsp; KATALOG PRODUK";
    eyebrow.hidden = false;
    eyebrow.style.setProperty("color", "#fff", "important");
  }
  if (title) {
    title.hidden = false;
    title.textContent = "Pilihan produk pangan untuk kebutuhan Anda.";
    title.style.removeProperty("font-size");
  }

  // Keep a sensible initial render while CMS data is loading.
  applyDescription(description, description?.textContent);
  applyCta(cta, cta?.textContent, cta?.getAttribute("href"));

  try {
    const { data, error } = await db.from("site_banners")
      .select("description,cta_label,cta_url,is_active")
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
    applyDescription(description, data.description);
    applyCta(cta, data.cta_label, data.cta_url);
  } catch (error) {
    console.error("Bos Pangan banner:", error);
  }
}

renderHomepageBanner();
