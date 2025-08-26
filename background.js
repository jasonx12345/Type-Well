// === Typewell (HF Router) — background.js ===

const MENU_PARENT = "typewell_parent";
const TONES = [
  { id: "professional", title: "Professional" },
  { id: "friendly",     title: "Friendly" },
  { id: "concise",      title: "Concise" },
  { id: "fix",          title: "Fix Grammar" }
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_PARENT, title: "Typewell: Polish Text", contexts: ["selection"] });
  for (const t of TONES) {
    chrome.contextMenus.create({ id: t.id, parentId: MENU_PARENT, title: t.title, contexts: ["selection"] });
  }
});

// Context menu → run
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const tone = TONES.find(t => t.id === info.menuItemId);
  if (!tone || !tab?.id) return;
  await runPolish(tab.id, tone.id);
});

// Popup → run
chrome.runtime.onMessage.addListener(async (msg, _sender, _sendResponse) => {
  if (msg?.type !== "TYPEWELL_POLISH_ACTIVE_TAB") return;
  const toneId = msg.tone || "professional";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await runPolish(tab.id, toneId);
});

// ---------- Main flow ----------
async function runPolish(tabId, toneId) {
  try {
    toast(tabId, "Typewell: contacting Hugging Face…");

    // 1) Capture selection
    let injection;
    try {
      [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        func: captureSelectionForTypewell
      });
    } catch (e) {
      console.warn("executeScript failed:", e);
      toast(tabId, "Typewell: can’t access this page.");
      return;
    }

    const result = injection?.result;
    if (!result?.hasSelection) {
      toast(tabId, "Typewell: select some text first.");
      return;
    }

    // 2) Rewrite via HF Router (OpenAI-compatible)
    const rewritten = await rewriteViaHF(result.text, toneId, tabId);

    // 3) Apply back to the page
    await chrome.scripting.executeScript({
      target: { tabId },
      args: [result, rewritten],
      func: applyRewriteForTypewell
    });

    toast(tabId, "Typewell: Polished ✓");
  } catch (err) {
    console.error("Typewell error:", err);
    toast(tabId, "Typewell: something went wrong.");
  }
}

// ---------- HF Router call ----------
const MODEL_ID = "openai/gpt-oss-20b:fireworks-ai"; // from the model card

async function rewriteViaHF(text, tone, tabId) {
  const { HF_API_KEY } = await chrome.storage.local.get(["HF_API_KEY"]);
  if (!HF_API_KEY) {
    toast(tabId, "Typewell: add your Hugging Face key in the popup.");
    return dummyPolish(text, tone); // fallback so UX still works
  }

  const system = [
    "You rewrite user text.",
    `Tone: ${tone}.`,
    "Keep meaning, facts, numbers, URLs, and line breaks.",
    "Fix grammar and clarity; make it sound professional when requested.",
    "Return only the rewritten text. No quotes or extra commentary."
  ].join(" ");

  try {
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text }
        ],
        temperature: 0.2,
        max_tokens: 256
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("HF router error:", res.status, errText);
      toast(tabId, `Typewell: HF ${res.status} — using fallback.`);
      return dummyPolish(text, tone);
    }

    const data = await res.json();
    const out = data?.choices?.[0]?.message?.content?.trim();
    if (!out) {
      console.warn("HF router: empty response", data);
      toast(tabId, "Typewell: HF empty — using fallback.");
      return dummyPolish(text, tone);
    }

    toast(tabId, "Typewell: HF ✓");
    return out;
  } catch (e) {
    console.error("HF call failed:", e);
    toast(tabId, "Typewell: network error — using fallback.");
    return dummyPolish(text, tone);
  }
}

// ---------- Injected helpers (run in the page) ----------
function captureSelectionForTypewell() {
  const sel = window.getSelection();
  const active = document.activeElement;

  // Inputs / Textareas
  if (active && (active.tagName === "TEXTAREA" ||
      (active.tagName === "INPUT" && /^(text|search|email|url|tel)$/i.test(active.type)))) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    const text = active.value.slice(start, end);
    if (!text) return { hasSelection: false };
    const marker = "tw_" + Math.random().toString(36).slice(2);
    active.setAttribute("data-typewell-marker", marker);
    return { hasSelection: true, kind: "textarea", marker, start, end, text };
  }

  // Content ranges
  if (sel && sel.rangeCount > 0 && String(sel).trim()) {
    const range = sel.getRangeAt(0);
    const startMarker = document.createElement("span");
    const endMarker = document.createElement("span");
    const startId = "twStart_" + Math.random().toString(36).slice(2);
    const endId   = "twEnd_"   + Math.random().toString(36).slice(2);
    startMarker.id = startId; startMarker.style.cssText = "display:none;";
    endMarker.id   = endId;   endMarker.style.cssText   = "display:none;";
    const r1 = range.cloneRange(); r1.collapse(true);  r1.insertNode(startMarker);
    const r2 = range.cloneRange(); r2.collapse(false); r2.insertNode(endMarker);
    const text = sel.toString();
    return { hasSelection: true, kind: "range", startId, endId, text };
  }
  return { hasSelection: false };
}

function applyRewriteForTypewell(selection, replacement) {
  if (!selection?.hasSelection) return;

  if (selection.kind === "textarea") {
    const el = document.querySelector(`[data-typewell-marker="${selection.marker}"]`);
    if (!el) return;
    const v = el.value;
    el.value = v.slice(0, selection.start) + replacement + v.slice(selection.end);
    el.removeAttribute("data-typewell-marker");
    const pos = selection.start + replacement.length;
    el.setSelectionRange(pos, pos);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (selection.kind === "range") {
    const startNode = document.getElementById(selection.startId);
    const endNode = document.getElementById(selection.endId);
    if (!startNode || !endNode) return;

    const range = document.createRange();
    range.setStartAfter(startNode);
    range.setEndBefore(endNode);
    range.deleteContents();

    const target = startNode.parentElement || document.body;

    const evt = new InputEvent("beforeinput", {
      inputType: "insertReplacementText",
      data: replacement,
      bubbles: true,
      cancelable: true
    });
    const prevented = !target.dispatchEvent(evt);

    if (!prevented) {
      range.insertNode(document.createTextNode(replacement));
    }
    startNode.remove();
    endNode.remove();
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// ---------- Fallback cleaner ----------
function dummyPolish(text, tone) {
  const trimmed = text.trim();
  let out = trimmed.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1");
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  if (tone === "concise") out = out.replace(/\b(just|really|very|actually|basically|kind of|sort of)\b/gi, "").replace(/\s{2,}/g, " ").trim();
  if (!/[.!?]"?$/.test(out)) out += ".";
  return out;
}

// ---------- Toast ----------
function toast(tabId, message) {
  chrome.scripting.executeScript({
    target: { tabId },
    args: [message],
    func: (msg) => {
      const el = document.createElement("div");
      el.textContent = msg;
      Object.assign(el.style, {
        position: "fixed",
        zIndex: 2147483647,
        right: "16px",
        bottom: "16px",
        padding: "10px 12px",
        background: "#111",
        color: "#fff",
        borderRadius: "10px",
        font: "12px system-ui",
        boxShadow: "0 6px 20px rgba(0,0,0,.2)"
      });
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }
  });
}
