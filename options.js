document.getElementById('saveButton').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const model = document.getElementById('model').value;
  chrome.storage.sync.set({ apiKey, model }, () => {
    console.log('API Key and Model saved');
    alert('Settings saved successfully.');
  });
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiKey', 'model'], (data) => {
    if (data.apiKey) {
      document.getElementById('apiKey').value = data.apiKey;
    }
    if (data.model) {
      document.getElementById('model').value = data.model;
    }
  });
});