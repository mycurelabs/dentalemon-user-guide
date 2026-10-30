// Small presentation touches that plain Markdown can't express.
// Runs on every page load, including instant navigation.
document$.subscribe(() => {
  const content = document.querySelector(".md-content");
  if (!content) return;

  // "### 3. Tap a tooth" -> a lemon badge with 3, then "Tap a tooth".
  content.querySelectorAll("h3").forEach((h) => {
    if (h.querySelector(".step-num")) return;
    const first = h.firstChild;
    if (!first || first.nodeType !== Node.TEXT_NODE) return;
    const m = first.textContent.match(/^\s*(\d+)\.\s+/);
    if (!m) return;
    first.textContent = first.textContent.slice(m[0].length);
    const badge = document.createElement("span");
    badge.className = "step-num";
    badge.setAttribute("aria-label", `Step ${m[1]}:`);
    badge.textContent = m[1];
    h.prepend(badge);
  });

  // "You should see: ..." -> the label stands out from the description.
  content.querySelectorAll("p.see").forEach((p) => {
    if (p.querySelector(".see-label")) return;
    const first = p.firstChild;
    if (!first || first.nodeType !== Node.TEXT_NODE) return;
    const m = first.textContent.match(/^\s*You should see:\s*/);
    if (!m) return;
    first.textContent = first.textContent.slice(m[0].length);
    const label = document.createElement("span");
    label.className = "see-label";
    label.textContent = "You should see: ";
    p.prepend(label);
  });
});
