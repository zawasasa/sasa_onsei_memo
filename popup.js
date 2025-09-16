document.addEventListener('DOMContentLoaded', () => {
  const openSidebarBtn = document.getElementById('openSidebar');
  const openSettingsBtn = document.getElementById('openSettings');

  openSidebarBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        if (window.voiceMemoSidebar) {
          window.voiceMemoSidebar.toggle();
        } else {
          const event = new CustomEvent('openVoiceMemoSidebar');
          document.dispatchEvent(event);
        }
      }
    });

    window.close();
  });

  openSettingsBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const event = new CustomEvent('openVoiceMemoSettings');
        document.dispatchEvent(event);
      }
    });

    window.close();
  });
});