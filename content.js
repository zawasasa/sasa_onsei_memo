let sidebar = null;
let settingsModal = null;

class VoiceMemoSidebar {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordings = [];
    this.isVisible = false;
    this.sidebar = null;
    this.recordingLimit = 5; // デフォルト5分
    this.totalCost = 0; // 総使用料金（円）
    this.usageCount = 0; // 使用回数
    this.init();
  }

  async init() {
    this.createSidebar();
    await this.loadHistoryFromStorage();
    await this.loadSettings();
    this.attachEventListeners();
    this.updateDisplay();
    // 初期化時に録音状態をリセット
    this.resetRecordingState();
  }

  createSidebar() {
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'voice-memo-sidebar';
    this.sidebar.innerHTML = `
      <div class="voice-memo-header">
        <div class="voice-memo-title-section">
          <h3 class="voice-memo-title">ささっと音声メモ</h3>
          <div class="voice-memo-version">v1.1.4</div>
        </div>
        <div class="voice-memo-header-buttons">
          <button id="voice-memo-settings" class="voice-memo-btn-header">⚙️ 設定</button>
        </div>
        <button id="voice-memo-close" class="voice-memo-btn-close">×</button>
      </div>

      <div class="voice-memo-notice" id="voice-memo-api-notice" style="display: none;">
        APIキーを入力してください
      </div>

      <div class="voice-memo-controls">
        <div class="voice-memo-control-section">
          <button id="voice-memo-record" class="voice-memo-btn voice-memo-btn-primary voice-memo-btn-record">
            🎙️ 録音開始
          </button>
          <button id="voice-memo-stop" class="voice-memo-btn voice-memo-btn-danger" style="display: none;">
            ⏹️ 録音停止
          </button>
          <button id="voice-memo-cancel" class="voice-memo-btn voice-memo-btn-secondary" style="display: none;">
            ❌ キャンセル
          </button>
        </div>
      </div>

      <div class="voice-memo-status" id="voice-memo-status"></div>

      <div class="voice-memo-history-section">
        <div class="voice-memo-history-header">
          <h4>履歴 <span id="voice-memo-history-count" class="voice-memo-count-badge">(0)</span></h4>
          <button id="voice-memo-clear-all" class="voice-memo-btn voice-memo-btn-small">🗑️ 全削除</button>
        </div>
        <div id="voice-memo-history-list" class="voice-memo-history-list"></div>
      </div>
    `;

    document.body.appendChild(this.sidebar);
  }

  attachEventListeners() {
    const closeBtn = this.sidebar.querySelector('#voice-memo-close');
    const recordBtn = this.sidebar.querySelector('#voice-memo-record');
    const stopBtn = this.sidebar.querySelector('#voice-memo-stop');
    const cancelBtn = this.sidebar.querySelector('#voice-memo-cancel');
    const settingsBtn = this.sidebar.querySelector('#voice-memo-settings');
    const clearAllBtn = this.sidebar.querySelector('#voice-memo-clear-all');

    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
    if (recordBtn) recordBtn.addEventListener('click', () => this.startRecording());
    if (stopBtn) stopBtn.addEventListener('click', () => this.stopRecording());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelRecording());
    if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettings());
    if (clearAllBtn) clearAllBtn.addEventListener('click', () => this.clearAllHistory());



    document.addEventListener('openVoiceMemoSidebar', () => this.show());
    document.addEventListener('openVoiceMemoSettings', () => this.openSettings());
  }


  show() {
    console.log('サイドバーを表示しようとしています', this.sidebar);
    if (this.sidebar) {
      this.sidebar.classList.add('voice-memo-visible');
      this.isVisible = true;
      // ページ全体を左にシフト
      document.body.classList.add('voice-memo-sidebar-open');
      document.documentElement.classList.add('voice-memo-sidebar-open');
      // 表示時に録音状態をリセット
      this.resetRecordingState();
      console.log('サイドバーが表示されました');
    } else {
      console.error('サイドバー要素が見つかりません');
    }
  }

  hide() {
    this.sidebar.classList.remove('voice-memo-visible');
    this.isVisible = false;
    // ページ全体のシフトを解除
    document.body.classList.remove('voice-memo-sidebar-open');
    document.documentElement.classList.remove('voice-memo-sidebar-open');
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      this.audioChunks = [];

      this.mediaRecorder.addEventListener('dataavailable', event => {
        this.audioChunks.push(event.data);
      });

      this.mediaRecorder.addEventListener('stop', () => {
        this.processRecording();
      });

      this.mediaRecorder.start();
      this.isRecording = true;
      this.updateRecordingUI(true);
      this.updateStatus('録音中...');

      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
          this.updateStatus(`最大録音時間（${this.recordingLimit}分）に達しました`);
        }
      }, this.recordingLimit * 60 * 1000);

    } catch (error) {
      console.error('録音開始エラー:', error);
      this.updateStatus('マイクアクセスが拒否されました。設定を確認してください。');
      // エラー時に録音状態をリセット
      this.resetRecordingState();
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;
      this.updateRecordingUI(false);
      this.updateStatus('音声を処理中...');
    } else {
      // 録音中でない場合は状態をリセット
      this.resetRecordingState();
    }
  }

  cancelRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;
      this.audioChunks = [];
      this.updateRecordingUI(false);
      this.updateStatus('録音がキャンセルされました');
    } else {
      // 録音中でない場合は状態をリセット
      this.resetRecordingState();
    }
  }

  async processRecording() {
    if (this.audioChunks.length === 0) {
      this.updateStatus('録音データがありません');
      return;
    }

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        this.updateStatus('OpenAI APIキーが設定されていません。設定画面で入力してください。');
        this.openSettings();
        return;
      }

      const transcription = await this.transcribeAudio(audioBlob, apiKey);
      if (transcription) {
        // 音声ファイルの詳細情報を取得
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const durationSeconds = audioBuffer.duration;
        const durationMinutes = durationSeconds / 60;

        // Whisper API 料金計算（$0.006/分、最小課金単位1秒）
        const costUSD = Math.max(0.0001, durationMinutes * 0.006); // 最低$0.0001（1秒分）
        const exchangeRate = 150; // 為替レート150円/ドル
        const costJPY = costUSD * exchangeRate;

        // 料金とファイル情報を記録
        const costInfo = {
          durationSeconds: Math.round(durationSeconds * 10) / 10,
          durationMinutes: Math.round(durationMinutes * 100) / 100,
          costUSD: Math.round(costUSD * 10000) / 10000,
          costJPY: Math.round(costJPY * 100) / 100,
          fileSize: Math.round(audioBlob.size / 1024 * 10) / 10, // KB
          exchangeRate: exchangeRate,
          timestamp: new Date().toISOString()
        };

        this.totalCost += costJPY;
        this.usageCount++;

        await this.addToHistory(transcription, costInfo);
        await this.saveSettingsData();
        this.updateDisplay();
        
        // 料金表示を分かりやすく改善
        const costDisplay = this.formatCostDisplay(costJPY);
        this.updateStatus(`文字起こし完了 (${costInfo.durationSeconds}秒, ${costDisplay}): ${transcription.substring(0, 40)}...`);

        audioContext.close();
      }
    } catch (error) {
      console.error('音声処理エラー:', error);
      this.updateStatus('文字起こしに失敗しました。APIキーやネットワーク接続を確認してください。');
    }
  }

  // 料金表示を分かりやすくフォーマットする関数
  formatCostDisplay(costJPY) {
    if (costJPY < 0.01) {
      // 0.01円未満は小数点以下3桁表示
      return `¥${Math.round(costJPY * 1000) / 1000}`;
    } else if (costJPY < 0.1) {
      // 0.1円未満は小数点以下2桁表示
      return `¥${Math.round(costJPY * 100) / 100}`;
    } else {
      // 0.1円以上は小数点以下1桁表示
      return `¥${Math.round(costJPY * 10) / 10}`;
    }
  }

  async transcribeAudio(audioBlob, apiKey) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ja');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('APIキーが無効です');
      } else if (response.status === 429) {
        throw new Error('API制限に達しました。しばらく待ってから再試行してください');
      }
      throw new Error(`API エラー: ${response.status}`);
    }

    const result = await response.json();
    return result.text;
  }

  async getApiKey() {
    return new Promise((resolve) => {
      try {
        // Chrome APIの存在とコンテキストの有効性をチェック
        if (typeof chrome === 'undefined' ||
            !chrome.storage ||
            !chrome.storage.sync ||
            typeof chrome.storage.sync.get !== 'function' ||
            !chrome.runtime ||
            !chrome.runtime.id) {
          console.warn('Chrome storage API が利用できません - localStorage を使用します');
          const fallbackKey = localStorage.getItem('voiceMemo_openaiApiKey');
          resolve(fallbackKey);
          return;
        }

        chrome.storage.sync.get(['openaiApiKey'], (result) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            if (error.message && error.message.includes('Extension context invalidated')) {
              console.warn('Extension context invalidated - localStorage を使用します');
            } else {
              console.error('Storage get error:', error);
            }
            const fallbackKey = localStorage.getItem('voiceMemo_openaiApiKey');
            resolve(fallbackKey);
          } else {
            resolve(result.openaiApiKey);
          }
        });
      } catch (error) {
        console.error('Storage access error:', error);
        const fallbackKey = localStorage.getItem('voiceMemo_openaiApiKey');
        resolve(fallbackKey);
      }
    });
  }

  async addToHistory(text, costInfo) {
    const now = new Date();
    const item = {
      id: Date.now(),
      timestamp: now.toISOString(),
      text: text,
      label: text.substring(0, 15) + (text.length > 15 ? '...' : ''),
      createdAt: now.toLocaleString('ja-JP'),
      costInfo: costInfo
    };

    this.recordings.unshift(item);

    if (this.recordings.length > 30) {
      this.recordings = this.recordings.slice(0, 30);
    }

    await this.saveHistoryToStorage();
    this.renderHistory();
  }

  renderHistory() {
    const historyList = this.sidebar?.querySelector('#voice-memo-history-list');
    const historyCount = this.sidebar?.querySelector('#voice-memo-history-count');

    if (!historyList || !historyCount) return;

    historyCount.textContent = `(${this.recordings.length})`;

    if (this.recordings.length === 0) {
      historyList.innerHTML = '<div class="voice-memo-empty">まだ録音がありません</div>';
      return;
    }

    historyList.innerHTML = this.recordings.map(item => `
      <div class="voice-memo-history-item" data-id="${item.id}">
        <div class="voice-memo-history-header">
          <div class="voice-memo-history-date">${item.createdAt}</div>
          <button class="voice-memo-btn-delete" data-id="${item.id}">🗑️ 削除</button>
        </div>
        <div class="voice-memo-history-label">${item.label}</div>
        <div class="voice-memo-history-text" contenteditable="true" data-id="${item.id}">${item.text}</div>
        <div class="voice-memo-history-meta">
          <span class="cost-detail">💰 $${item.costInfo.costUSD} (¥${item.costInfo.costJPY})</span>
          <span class="duration-detail">⏱️ ${item.costInfo.durationSeconds}秒</span>
        </div>
        <button class="voice-memo-btn-copy" data-text="${item.text}">📋 コピー</button>
      </div>
    `).join('');

    this.attachHistoryEventListeners();
  }

  attachHistoryEventListeners() {
    const historyList = this.sidebar?.querySelector('#voice-memo-history-list');
    if (!historyList) return;

    historyList.querySelectorAll('.voice-memo-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.getAttribute('data-id'));
        this.deleteHistory(id);
      });
    });

    historyList.querySelectorAll('.voice-memo-btn-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const text = e.target.getAttribute('data-text');
        this.copyToClipboard(text);
      });
    });

    historyList.querySelectorAll('.voice-memo-history-text').forEach(textEl => {
      textEl.addEventListener('blur', (e) => {
        const id = parseInt(e.target.getAttribute('data-id'));
        this.updateHistoryText(id, e.target.textContent);
      });
    });
  }

  async deleteHistory(id) {
    this.recordings = this.recordings.filter(item => item.id !== id);
    await this.saveHistoryToStorage();
    this.renderHistory();
  }

  async updateHistoryText(id, newText) {
    const item = this.recordings.find(r => r.id === id);
    if (item) {
      item.text = newText;
      item.label = newText.substring(0, 15) + (newText.length > 15 ? '...' : '');
      await this.saveHistoryToStorage();
    }
  }

  async clearAllHistory() {
    if (confirm('全ての履歴を削除しますか？この操作は取り消せません。')) {
      this.recordings = [];
      await this.saveHistoryToStorage();
      this.renderHistory();
    }
  }

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.updateStatus('クリップボードにコピーしました');
      setTimeout(() => this.updateStatus(''), 2000);
    }).catch(err => {
      console.error('コピーに失敗:', err);
      this.updateStatus('コピーに失敗しました');
    });
  }

  updateRecordingUI(isRecording) {
    const recordBtn = this.sidebar?.querySelector('#voice-memo-record');
    const stopBtn = this.sidebar?.querySelector('#voice-memo-stop');
    const cancelBtn = this.sidebar?.querySelector('#voice-memo-cancel');

    if (isRecording) {
      if (recordBtn) recordBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'inline-block';
      if (cancelBtn) cancelBtn.style.display = 'inline-block';
      this.sidebar?.classList.add('recording');
    } else {
      if (recordBtn) recordBtn.style.display = 'inline-block';
      if (stopBtn) stopBtn.style.display = 'none';
      if (cancelBtn) cancelBtn.style.display = 'none';
      this.sidebar?.classList.remove('recording');
    }
  }

  resetRecordingState() {
    // 録音状態を完全にリセット
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    
    // UIを録音停止状態に設定
    this.updateRecordingUI(false);
    
    // ステータスをクリア
    this.updateStatus('');
    
    console.log('録音状態をリセットしました');
  }

  updateStatus(message) {
    const statusElement = this.sidebar?.querySelector('#voice-memo-status');
    if (statusElement) {
      statusElement.textContent = message;
      if (message) {
        setTimeout(() => {
          if (statusElement.textContent === message) {
            statusElement.textContent = '';
          }
        }, 5000);
      }
    }
  }

  async saveHistoryToStorage() {
    return new Promise((resolve) => {
      try {
        if (typeof chrome === 'undefined' ||
            !chrome.storage ||
            !chrome.storage.sync ||
            typeof chrome.storage.sync.set !== 'function') {
          console.error('Chrome storage API が利用できません - localStorage を使用します');
          // localStorage をフォールバックとして使用
          localStorage.setItem('voiceMemo_history', JSON.stringify(this.recordings));
          resolve();
          return;
        }

        chrome.storage.sync.set({
          voiceMemoHistory: this.recordings
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Storage set error:', chrome.runtime.lastError);
            // フォールバックとして localStorage を使用
            localStorage.setItem('voiceMemo_history', JSON.stringify(this.recordings));
          }
          resolve();
        });
      } catch (error) {
        console.error('Storage save error:', error);
        // フォールバックとして localStorage を使用
        localStorage.setItem('voiceMemo_history', JSON.stringify(this.recordings));
        resolve();
      }
    });
  }

  async loadHistoryFromStorage() {
    return new Promise((resolve) => {
      try {
        if (typeof chrome === 'undefined' ||
            !chrome.storage ||
            !chrome.storage.sync ||
            typeof chrome.storage.sync.get !== 'function') {
          console.error('Chrome storage API が利用できません - localStorage を使用します');
          // localStorage をフォールバックとして使用
          const fallbackHistory = localStorage.getItem('voiceMemo_history');
          this.recordings = fallbackHistory ? JSON.parse(fallbackHistory) : [];
          this.renderHistory();
          resolve();
          return;
        }

        chrome.storage.sync.get(['voiceMemoHistory'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Storage load error:', chrome.runtime.lastError);
            // フォールバックとして localStorage を使用
            const fallbackHistory = localStorage.getItem('voiceMemo_history');
            this.recordings = fallbackHistory ? JSON.parse(fallbackHistory) : [];
          } else {
            this.recordings = result.voiceMemoHistory || [];
          }
          this.renderHistory();
          resolve();
        });
      } catch (error) {
        console.error('Storage load error:', error);
        // フォールバックとして localStorage を使用
        const fallbackHistory = localStorage.getItem('voiceMemo_history');
        this.recordings = fallbackHistory ? JSON.parse(fallbackHistory) : [];
        this.renderHistory();
        resolve();
      }
    });
  }

  openSettings() {
    try {
      console.log('設定画面を開こうとしています');
      if (!settingsModal) {
        console.log('設定モーダルを新規作成します');
        this.createSettingsModal();
      }
      if (settingsModal) {
        settingsModal.style.display = 'flex';
        this.loadCurrentApiKey();
        console.log('設定画面を表示しました');
      } else {
        console.error('設定モーダルの作成に失敗しました');
        this.updateStatus('設定画面の表示に失敗しました');
      }
    } catch (error) {
      console.error('設定画面表示エラー:', error);
      this.updateStatus('設定画面の表示に失敗しました');
    }
  }

  createSettingsModal() {
    settingsModal = document.createElement('div');
    settingsModal.id = 'voice-memo-settings-modal';
    settingsModal.innerHTML = `
      <div class="voice-memo-modal-content">
        <div class="voice-memo-modal-header">
          <h3>設定</h3>
          <button id="voice-memo-settings-close" class="voice-memo-btn-close">×</button>
        </div>

        <div class="voice-memo-modal-body">
          <div class="voice-memo-form-group">
            <label for="voice-memo-api-key">OpenAI APIキー:</label>
            <div class="voice-memo-input-group">
              <input type="text" id="voice-memo-api-key" class="voice-memo-input" placeholder="sk-..." autocomplete="off" spellcheck="false" readonly="false" disabled="false" style="font-family: monospace; -webkit-user-select: text; user-select: text; pointer-events: auto;">
              <button type="button" id="voice-memo-clear-btn" class="voice-memo-btn-clear-input">クリア</button>
              <button type="button" id="voice-memo-show-hide-btn" class="voice-memo-btn-show-hide">隠す</button>
            </div>
            <small>APIキーは暗号化されてChromeに保存されます。<strong>フィールドをクリックしてCtrl+V（⌘+V）で貼り付けてください。</strong></small>
          </div>

          <div class="voice-memo-form-group">
            <label for="voice-memo-recording-limit">録音時間上限:</label>
            <select id="voice-memo-recording-limit" class="voice-memo-select">
              <option value="1">1分</option>
              <option value="2">2分</option>
              <option value="3">3分</option>
              <option value="4">4分</option>
              <option value="5" selected>5分</option>
            </select>
          </div>

          <div class="voice-memo-form-group">
            <label>API使用料金:</label>
            <div class="voice-memo-cost-display">
              <div class="voice-memo-cost-item">
                <span>総使用料金:</span>
                <span id="voice-memo-settings-total-cost">¥0</span>
              </div>
              <div class="voice-memo-cost-item">
                <span>使用回数:</span>
                <span id="voice-memo-usage-count">0回</span>
              </div>
            </div>
          </div>
        </div>

        <div class="voice-memo-modal-footer">
          <button id="voice-memo-settings-save" class="voice-memo-btn voice-memo-btn-primary">保存</button>
          <button id="voice-memo-settings-cancel" class="voice-memo-btn voice-memo-btn-secondary">キャンセル</button>
        </div>
      </div>
    `;

    document.body.appendChild(settingsModal);

    const closeBtn = settingsModal.querySelector('#voice-memo-settings-close');
    const cancelBtn = settingsModal.querySelector('#voice-memo-settings-cancel');
    const saveBtn = settingsModal.querySelector('#voice-memo-settings-save');
    const clearBtn = settingsModal.querySelector('#voice-memo-clear-btn');
    const showHideBtn = settingsModal.querySelector('#voice-memo-show-hide-btn');
    const apiKeyInput = settingsModal.querySelector('#voice-memo-api-key');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          await this.saveSettings();
        } catch (error) {
          console.error('設定保存エラー:', error);
          this.updateStatus('設定の保存に失敗しました');
        }
      });
    }

    if (clearBtn && apiKeyInput) {
      clearBtn.addEventListener('click', () => {
        apiKeyInput.value = '';
        apiKeyInput.focus();
        console.log('APIキーフィールドをクリアしました');
      });
    }

    if (showHideBtn && apiKeyInput) {
      let isHidden = false;

      showHideBtn.addEventListener('click', () => {
        if (isHidden) {
          // 表示状態にする
          apiKeyInput.type = 'text';
          apiKeyInput.style.webkitTextSecurity = 'none';
          showHideBtn.textContent = '隠す';
          isHidden = false;
        } else {
          // 隠す状態にする
          apiKeyInput.type = 'password';
          apiKeyInput.style.webkitTextSecurity = 'disc';
          showHideBtn.textContent = '表示';
          isHidden = true;
        }
      });
    }

    // 入力フィールドの設定と検証
    if (apiKeyInput) {
      // 入力フィールドが確実に編集可能であることを保証
      apiKeyInput.removeAttribute('readonly');
      apiKeyInput.removeAttribute('disabled');
      apiKeyInput.style.pointerEvents = 'auto';
      apiKeyInput.contentEditable = 'false'; // divではないのでfalse

      // フィールドにフォーカスが当たった時の処理
      apiKeyInput.addEventListener('focus', () => {
        console.log('APIキーフィールドがフォーカスされました - Ctrl+V (⌘+V) で貼り付けできます');
        // フォーカス時に全選択して上書きしやすくする
        setTimeout(() => apiKeyInput.select(), 10);
      });

      // 貼り付け操作のサポート
      apiKeyInput.addEventListener('paste', (e) => {
        console.log('貼り付けイベントが発生しました');
        // イベントを妨げない
        setTimeout(() => {
          const value = apiKeyInput.value.trim();
          console.log('貼り付け後の値:', value.substring(0, 10) + '...');
          this.validateApiKey(apiKeyInput, value);
        }, 100);
      });

      // 右クリックメニューも確実に有効化
      apiKeyInput.addEventListener('contextmenu', (e) => {
        // デフォルトの右クリックメニューを許可
        console.log('右クリックメニューが開かれました');
      });

      // リアルタイム入力値の検証
      apiKeyInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        this.validateApiKey(apiKeyInput, value);
      });

      // Enterキーで保存
      apiKeyInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          try {
            await this.saveSettings();
          } catch (error) {
            console.error('設定保存エラー:', error);
            this.updateStatus('設定の保存に失敗しました');
          }
        }
      });
    }

    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
      }
    });
  }

  validateApiKey(input, value) {
    if (!input) return;

    if (value.length === 0) {
      // 空の場合
      input.style.borderColor = '#ced4da';
      input.style.backgroundColor = '';
      return;
    }

    if (value.startsWith('sk-') && value.length > 20) {
      // 有効なAPIキー形式
      input.style.borderColor = '#28a745';
      input.style.backgroundColor = '#d4edda';
      console.log('有効なAPIキー形式です');
    } else {
      // 無効なAPIキー形式
      input.style.borderColor = '#dc3545';
      input.style.backgroundColor = '#f8d7da';
      console.log('無効なAPIキー形式です');
    }
  }

  async loadCurrentApiKey() {
    const apiKey = await this.getApiKey();
    const input = settingsModal?.querySelector('#voice-memo-api-key');
    const showHideBtn = settingsModal?.querySelector('#voice-memo-show-hide-btn');

    if (apiKey && input) {
      input.value = apiKey;
      input.placeholder = '既存のAPIキーが設定されています';
      console.log('既存のAPIキーを読み込みました（マスク表示）');

      // 既存のキーがある場合は入力フィールドの背景色を変更して視覚的に示す
      input.style.backgroundColor = '#e8f5e8';
    } else if (input) {
      input.placeholder = 'sk-から始まるAPIキーを入力してください';
      input.style.backgroundColor = '';
    }

    // 表示/非表示ボタンの初期設定（デフォルトで表示状態）
    if (showHideBtn) {
      showHideBtn.textContent = '隠す';
    }
    if (input) {
      input.type = 'text';
    }

    // 設定値を読み込み
    await this.loadSettings();
    this.updateSettingsDisplay();
  }

  async loadSettings() {
    return new Promise((resolve) => {
      try {
        // Chrome APIの存在とコンテキストの有効性をチェック
        if (typeof chrome === 'undefined' ||
            !chrome.storage ||
            !chrome.storage.sync ||
            typeof chrome.storage.sync.get !== 'function' ||
            !chrome.runtime ||
            !chrome.runtime.id) {
          console.warn('Chrome storage API が利用できません - localStorage を使用します');
          this.loadSettingsFromLocalStorage();
          resolve();
          return;
        }

        chrome.storage.sync.get(['voiceMemoSettings'], (result) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            if (error.message && error.message.includes('Extension context invalidated')) {
              console.warn('Extension context invalidated - localStorage を使用します');
            } else {
              console.error('Settings load error:', error);
            }
            this.loadSettingsFromLocalStorage();
          } else {
            const settings = result.voiceMemoSettings || {};
            this.recordingLimit = settings.recordingLimit || 5;
            this.totalCost = settings.totalCost || 0;
            this.usageCount = settings.usageCount || 0;
          }
          resolve();
        });
      } catch (error) {
        console.error('Settings load error:', error);
        this.loadSettingsFromLocalStorage();
        resolve();
      }
    });
  }

  loadSettingsFromLocalStorage() {
    try {
      const settings = JSON.parse(localStorage.getItem('voiceMemo_settings') || '{}');
      this.recordingLimit = settings.recordingLimit || 5;
      this.totalCost = settings.totalCost || 0;
      this.usageCount = settings.usageCount || 0;
    } catch (error) {
      console.error('localStorage load error:', error);
      // デフォルト値を使用
      this.recordingLimit = 5;
      this.totalCost = 0;
      this.usageCount = 0;
    }
  }

  async saveSettingsData() {
    const settings = {
      recordingLimit: this.recordingLimit,
      totalCost: this.totalCost,
      usageCount: this.usageCount
    };

    return new Promise((resolve) => {
      try {
        // Chrome APIの存在とコンテキストの有効性をチェック
        if (typeof chrome === 'undefined' ||
            !chrome.storage ||
            !chrome.storage.sync ||
            typeof chrome.storage.sync.set !== 'function' ||
            !chrome.runtime ||
            !chrome.runtime.id) {
          console.warn('Chrome storage API が利用できません - localStorage を使用します');
          this.saveSettingsToLocalStorage(settings);
          resolve();
          return;
        }

        chrome.storage.sync.set({
          voiceMemoSettings: settings
        }, () => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            if (error.message && error.message.includes('Extension context invalidated')) {
              console.warn('Extension context invalidated - localStorage を使用します');
            } else {
              console.error('Settings save error:', error);
            }
            this.saveSettingsToLocalStorage(settings);
          }
          resolve();
        });
      } catch (error) {
        console.error('Settings save error:', error);
        this.saveSettingsToLocalStorage(settings);
        resolve();
      }
    });
  }

  saveSettingsToLocalStorage(settings) {
    try {
      localStorage.setItem('voiceMemo_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('localStorage save error:', error);
    }
  }

  async updateDisplay() {
    // APIキーの状態をチェックして通知の表示を制御
    const apiNotice = this.sidebar?.querySelector('#voice-memo-api-notice');
    if (apiNotice) {
      const apiKey = await this.getApiKey();
      if (apiKey) {
        // APIキーが設定されている場合は通知を隠す
        apiNotice.style.display = 'none';
      } else {
        // APIキーが未設定の場合は通知を表示
        apiNotice.style.display = 'block';
      }
    }
  }

  updateSettingsDisplay() {
    // 設定画面の表示更新
    try {
      const recordingLimitSelect = settingsModal?.querySelector('#voice-memo-recording-limit');
      const settingsTotalCostEl = settingsModal?.querySelector('#voice-memo-settings-total-cost');
      const usageCountEl = settingsModal?.querySelector('#voice-memo-usage-count');
      
      if (recordingLimitSelect) {
        recordingLimitSelect.value = this.recordingLimit;
      }
      if (settingsTotalCostEl) {
        settingsTotalCostEl.textContent = `¥${Math.round(this.totalCost)}`;
      }
      if (usageCountEl) {
        usageCountEl.textContent = `${this.usageCount}回`;
      }
    } catch (error) {
      console.error('設定画面表示更新エラー:', error);
    }
  }

  async saveSettings() {
    const input = settingsModal?.querySelector('#voice-memo-api-key');
    const recordingLimitSelect = settingsModal?.querySelector('#voice-memo-recording-limit');
    
    if (!input) return;

    const apiKey = input.value.trim();
    const recordingLimit = parseInt(recordingLimitSelect?.value || '5');

    if (!apiKey) {
      alert('APIキーを入力してください');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      alert('有効なOpenAI APIキーを入力してください（sk-で始まる必要があります）');
      return;
    }

    // 録音時間制限を更新
    this.recordingLimit = recordingLimit;

    try {
      // Chrome APIの存在とコンテキストの有効性をチェック
      if (typeof chrome === 'undefined' ||
          !chrome.storage ||
          !chrome.storage.sync ||
          typeof chrome.storage.sync.set !== 'function' ||
          !chrome.runtime ||
          !chrome.runtime.id) {
        console.warn('Chrome storage API が利用できません - localStorage を使用します');
        localStorage.setItem('voiceMemo_openaiApiKey', apiKey);
        await this.saveSettingsData();
        settingsModal.style.display = 'none';
        this.updateDisplay();
        this.updateStatus('設定を保存しました（ローカルストレージ）');
        return;
      }

      chrome.storage.sync.set({
        openaiApiKey: apiKey
      }, async () => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError;
          if (error.message && error.message.includes('Extension context invalidated')) {
            console.warn('Extension context invalidated - localStorage を使用します');
          } else {
            console.error('Settings save error:', error);
          }
          localStorage.setItem('voiceMemo_openaiApiKey', apiKey);
          await this.saveSettingsData();
          settingsModal.style.display = 'none';
          this.updateDisplay();
          this.updateStatus('設定を保存しました（ローカルストレージ）');
        } else {
          await this.saveSettingsData();
          settingsModal.style.display = 'none';
          this.updateDisplay();
          this.updateStatus('設定を保存しました');
        }
      });
    } catch (error) {
      console.error('Settings save error:', error);
      localStorage.setItem('voiceMemo_openaiApiKey', apiKey);
      await this.saveSettingsData();
      settingsModal.style.display = 'none';
      this.updateDisplay();
      this.updateStatus('設定を保存しました（ローカルストレージ）');
    }
  }
}

function initVoiceMemoSidebar() {
  try {
    if (!window.voiceMemoSidebar) {
      window.voiceMemoSidebar = new VoiceMemoSidebar();
      sidebar = window.voiceMemoSidebar;
      console.log('音声メモサイドバーを初期化しました');

      // Chrome API の状態をログ出力
      if (typeof chrome === 'undefined' || !chrome.storage) {
        console.warn('Chrome storage API が利用できません - localStorage をフォールバックとして使用');
      } else {
        console.log('Chrome storage API が利用可能です');
      }
    }
  } catch (error) {
    console.error('サイドバー初期化エラー:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVoiceMemoSidebar);
} else {
  initVoiceMemoSidebar();
}

document.addEventListener('openVoiceMemoSidebar', () => {
  if (!window.voiceMemoSidebar) {
    initVoiceMemoSidebar();
  }
  window.voiceMemoSidebar?.show();
});

document.addEventListener('openVoiceMemoSettings', () => {
  if (!window.voiceMemoSidebar) {
    initVoiceMemoSidebar();
  }
  window.voiceMemoSidebar?.openSettings();
});