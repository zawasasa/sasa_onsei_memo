chrome.runtime.onInstalled.addListener(() => {
  console.log('ささっと音声メモ拡張機能がインストールされました');
});

chrome.action.onClicked.addListener((tab) => {
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
});