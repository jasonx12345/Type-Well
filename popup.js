// Tone buttons
document.querySelectorAll('button[data-tone]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tone = btn.getAttribute('data-tone');
    chrome.runtime.sendMessage({ type: 'TYPEWELL_POLISH_ACTIVE_TAB', tone });
    window.close();
  });
});

// API key storage (use a fixed key name)
const keyInput = document.getElementById('hfKey');
const saveBtn  = document.getElementById('saveKey');
const clearBtn = document.getElementById('clearKey');

const KEY_NAME = 'HF_API_KEY';

// load
chrome.storage.local.get([KEY_NAME], (obj) => {
  if (obj[KEY_NAME]) keyInput.value = obj[KEY_NAME];
});

// save
saveBtn?.addEventListener('click', async (e) => {
  e.preventDefault();
  await chrome.storage.local.set({ [KEY_NAME]: keyInput.value.trim() });
  saveBtn.textContent = 'Saved ✓';
  setTimeout(() => (saveBtn.textContent = 'Save'), 900);
});

// clear
clearBtn?.addEventListener('click', async (e) => {
  e.preventDefault();
  await chrome.storage.local.remove(KEY_NAME);
  keyInput.value = '';
  clearBtn.textContent = 'Cleared ✓';
  setTimeout(() => (clearBtn.textContent = 'Clear'), 900);
});
