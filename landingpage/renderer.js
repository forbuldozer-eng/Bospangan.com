import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import DOMPurify from "https://esm.sh/dompurify@3.2.6";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/auth-config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const params = new URLSearchParams(location.search);
const slug = (params.get("slug") || location.pathname.split("/").filter(Boolean).pop() || "").trim();
const titleNode = document.querySelector("[data-landing-title]");
const excerptNode = document.querySelector("[data-landing-excerpt]");
const imageNode = document.querySelector("[data-landing-image]");
const contentNode = document.querySelector("[data-landing-content]");
const messageNode = document.querySelector("[data-landing-message]");

function showError(message) {
  document.title = "Halaman tidak ditemukan | Bos Pangan";
  if (messageNode) { messageNode.textContent = message; messageNode.classList.remove("hidden"); }
  document.querySelector("[data-landing-page]")?.classList.remove("hidden");
}
async function render() {
  if (!slug) return showError("Halaman yang Anda cari tidak tersedia.");
  const {data,error} = await db.from("landing_pages").select("title,excerpt,content_html,hero_image_url,seo_title,seo_description,status").eq("slug",slug).eq("status","published").maybeSingle();
  if (error || !data) return showError("Halaman tidak ditemukan atau belum dipublikasikan.");
  document.title = data.seo_title || data.title;
  let description = document.querySelector('meta[name="description"]');
  if (!description) { description = document.createElement("meta"); description.name="description"; document.head.append(description); }
  description.content = data.seo_description || data.excerpt || "";
  titleNode.textContent = data.title;
  excerptNode.textContent = data.excerpt || "";
  if (data.hero_image_url) { imageNode.src = data.hero_image_url; imageNode.alt = data.title; imageNode.hidden=false; }
  contentNode.innerHTML = DOMPurify.sanitize(data.content_html || "", {USE_PROFILES:{html:true}});
  messageNode.textContent = ""; messageNode.classList.add("hidden");
  document.querySelector("[data-landing-page]")?.classList.remove("hidden");
}
render().catch(() => showError("Halaman gagal dimuat. Silakan coba kembali."));
