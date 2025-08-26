# Typewell — Chrome extension for instant text polishing

Typewell lets you highlight text on any page and rewrite it with one click:
- **Professional** — formal, clear, business-ready
- **Friendly** — warm, approachable
- **Concise** — tighter wording
- **Fix grammar** — corrects mistakes without changing tone

Powered by the **Hugging Face Router** (OpenAI-compatible API). Your key is stored locally in Chrome; nothing is hard-coded in the repo.

---

## Demo (how it works)

1. Select text on a page (e.g., a textarea or rich-text field).
2. Click the Typewell icon → choose **Professional**, **Friendly**, **Concise**, or **Fix Grammar**.
3. The selected text is replaced inline with the improved version.

> Note: Chrome blocks extensions on a few pages (Chrome Web Store, `chrome://*`, built-in PDF viewer). Test on a normal site.

---

## Install (developer / local)

1. **Clone or download** this repo.
2. Open **Chrome** → `chrome://extensions` → toggle **Developer mode** (top right).
3. Click **Load unpacked** → select the project folder.
4. Pin the extension to your toolbar (optional).

---

## Setup (Hugging Face key)

1. Click the extension icon to open the popup.
2. Expand **“⚙️ Hugging Face API key”**.
3. Paste your token (starts with `hf_...`) → **Save**.

The key is stored in `chrome.storage.local` under `HF_API_KEY`.  
If you ever committed a key by accident, **revoke it** in your HF account and save a new one in the popup.

---

## Usage tips

- Works in inputs, textareas, and most rich editors (Gmail, Notion, etc.).
- If a site blocks injection, you’ll see a toast like “can’t access this page.”
- You’ll see **“Typewell: HF ✓”** when the API rewrites successfully.
- If the API fails (bad key/rate limit), Typewell falls back to a light local cleanup.

---


