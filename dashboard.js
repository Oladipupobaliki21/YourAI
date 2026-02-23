/* ============================================================
   YourAI Dashboard — Main Application Logic
   Powered by Google Gemini API + Web Speech API
   ============================================================ */

// ==================== STATE ====================
const APP_KEY = 'yourAI_app';
const USER_KEY = 'yourAI_user';

let state = {
  currentMode: 'chat',
  currentConversationId: null,
  conversations: [],
  userProfile: {},
  settings: {
    apiKey: '',
    model: 'gemini-1.5-flash',
    theme: 'dark',
    tts: false
  },
  attachments: [],
  isLoading: false,
  isRecording: false,
  isCallActive: false,
  callMicActive: false,
  callSpeakerActive: true
};

let recognition = null;
let callRecognition = null;
let speechSynth = window.speechSynthesis;

// ==================== STORAGE ====================
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(APP_KEY) || '{}');
    const user = JSON.parse(localStorage.getItem(USER_KEY) || '{}');

    state.conversations = saved.conversations || [];
    state.settings = { ...state.settings, ...(saved.settings || {}) };
    state.userProfile = saved.userProfile || {};

    // Merge user info into profile
    if (user.name && !state.userProfile.name) {
      state.userProfile.name = user.name;
      state.userProfile.bio = user.bio || state.userProfile.bio || '';
    }

    applyTheme(state.settings.theme || 'dark');
  } catch (e) {
    console.warn('Failed to load state:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem(APP_KEY, JSON.stringify({
      conversations: state.conversations,
      settings: state.settings,
      userProfile: state.userProfile
    }));
    // Keep user key in sync
    const user = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    localStorage.setItem(USER_KEY, JSON.stringify({
      ...user,
      name: state.userProfile.name || user.name,
      bio: state.userProfile.bio || user.bio
    }));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

// ==================== GEMINI API ====================
async function callGemini(messages, systemPrompt = '') {
  const apiKey = state.settings.apiKey;
  if (!apiKey) throw new Error('NO_API_KEY');

  const model = state.settings.model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Limit history to last 30 messages to keep tokens reasonable
  const limited = messages.slice(-30);

  const body = {
    contents: limited.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 4096,
      topP: 0.95
    }
  };

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `API error ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
}

// Streaming version for chat
async function callGeminiStream(messages, systemPrompt = '', onChunk) {
  const apiKey = state.settings.apiKey;
  if (!apiKey) throw new Error('NO_API_KEY');

  const model = state.settings.model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const limited = messages.slice(-30);
  const body = {
    contents: limited.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    generationConfig: { temperature: 0.9, maxOutputTokens: 4096, topP: 0.95 }
  };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) {
            fullText += text;
            onChunk(fullText);
          }
        } catch {}
      }
    }
  }
  return fullText;
}

// ==================== IMAGE GENERATION ====================
async function generateImageFromPrompt(prompt, style, width = 1024, height = 1024) {
  const fullPrompt = style ? `${prompt}, ${style} style, high quality, detailed` : prompt;
  const encoded = encodeURIComponent(fullPrompt);
  // Pollinations.ai — free, no API key needed
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&seed=${Date.now()}`;
}

// ==================== SYSTEM PROMPTS ====================
function getSystemPrompt() {
  const p = state.userProfile;
  const hasProfile = p.name || p.bio;

  let base = `You are YourAI, a powerful and personal AI assistant. You are intelligent, creative, helpful, and concise. You use markdown formatting for structured responses including code blocks, bullet points, headers, and tables when appropriate.`;

  if (hasProfile) {
    const links = [p.github, p.linkedin, p.twitter, p.instagram, p.website, p.linktree]
      .filter(Boolean).join(', ');
    base += `\n\nUSER PROFILE:\n`;
    if (p.name) base += `Name: ${p.name}\n`;
    if (p.role) base += `Role: ${p.role}\n`;
    if (p.bio) base += `Bio: ${p.bio}\n`;
    if (p.interests) base += `Interests: ${p.interests}\n`;
    if (links) base += `Social/Web presence: ${links}\n`;
    base += `\nUse this profile to personalize responses, reference their background when relevant, and help them with goals aligned to their profession and interests.`;
  }

  return base;
}

function getResearchSystemPrompt(depth) {
  const depthMap = {
    overview: 'concise overview with key highlights',
    detailed: 'comprehensive analysis with examples and data',
    expert: 'deep expert-level analysis with nuanced insights, technical details, and implications'
  };
  return `You are YourAI in Research Mode — a highly intelligent research assistant similar to Perplexity AI. Provide a ${depthMap[depth] || 'detailed analysis'}.

Structure your response EXACTLY as follows:

## 📋 Summary
A 2-3 sentence executive summary.

## 🔍 Key Findings
- Bullet points with the most important findings (5-8 points)

## 📊 Detailed Analysis
In-depth exploration with sections and subsections.

## 💡 Key Takeaways
3-5 actionable insights or conclusions.

## ❓ Follow-up Questions
3 interesting follow-up questions the user might want to explore.

Use markdown formatting, be factual and balanced.`;
}

// ==================== CONVERSATIONS ====================
function createConversation(firstMsg = '') {
  const id = 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const title = firstMsg ? truncate(firstMsg, 36) : 'New Chat';
  const conv = {
    id,
    title,
    model: state.settings.model,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };
  state.conversations.unshift(conv);
  state.currentConversationId = id;
  saveState();
  return conv;
}

function getCurrentConversation() {
  if (!state.currentConversationId) return null;
  return state.conversations.find(c => c.id === state.currentConversationId) || null;
}

function loadConversation(id) {
  state.currentConversationId = id;
  renderMessages();
  renderRecentChats();
  showPanel('chatPanel');
  updatePageTitle('Chat');
  updateNavActive('chat');
  closeSidebar();
}

function deleteConversation(id, e) {
  if (e) e.stopPropagation();
  state.conversations = state.conversations.filter(c => c.id !== id);
  if (state.currentConversationId === id) {
    state.currentConversationId = null;
  }
  saveState();
  renderMessages();
  renderRecentChats();
  renderHistoryPanel();
  showToast('Conversation deleted', 'success');
}

function addMessage(role, content) {
  let conv = getCurrentConversation();
  if (!conv) conv = createConversation(role === 'user' ? content : '');

  const msg = { id: 'm_' + Date.now(), role, content, timestamp: Date.now() };
  conv.messages.push(msg);
  conv.updatedAt = Date.now();

  // Update title from first user message
  if (role === 'user' && conv.messages.filter(m => m.role === 'user').length === 1) {
    conv.title = truncate(content, 36);
  }

  saveState();
  return msg;
}

// ==================== RENDER MESSAGES ====================
function renderMessages() {
  const messagesEl = document.getElementById('messages');
  const welcomeEl = document.getElementById('welcome');
  const conv = getCurrentConversation();

  if (!conv || conv.messages.length === 0) {
    messagesEl.innerHTML = '';
    welcomeEl.classList.remove('hidden');
    return;
  }

  welcomeEl.classList.add('hidden');
  messagesEl.innerHTML = '';

  for (const msg of conv.messages) {
    messagesEl.appendChild(buildMsgElement(msg));
  }

  scrollToBottom();
}

function buildMsgElement(msg) {
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${msg.role === 'user' ? 'user' : 'ai'}`;
  wrapper.dataset.id = msg.id;

  const profile = state.userProfile;
  const userName = profile.name ? profile.name.split(' ')[0] : 'You';
  const userInitial = userName[0].toUpperCase();

  const isUser = msg.role === 'user';
  const avatarHTML = isUser
    ? `<div class="msg-avatar">${userInitial}</div>`
    : `<div class="msg-avatar">Y</div>`;

  const renderedContent = isUser
    ? escapeHtml(msg.content).replace(/\n/g, '<br>')
    : renderMarkdown(msg.content);

  const time = formatTime(msg.timestamp);

  wrapper.innerHTML = `
    ${avatarHTML}
    <div class="msg-content">
      <div class="msg-name">${isUser ? userName : 'YourAI'} · ${time}</div>
      <div class="msg-bubble">${renderedContent}</div>
      <div class="msg-actions">
        <button class="msg-action-btn" onclick="copyMessage('${msg.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </button>
        ${!isUser ? `<button class="msg-action-btn" onclick="speakMessage('${msg.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          Speak
        </button>` : ''}
      </div>
    </div>
  `;

  // Highlight code blocks
  wrapper.querySelectorAll('pre code').forEach(block => {
    if (window.hljs) hljs.highlightElement(block);
  });

  return wrapper;
}

function renderMarkdown(text) {
  if (!window.marked) return escapeHtml(text).replace(/\n/g, '<br>');

  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: (code, lang) => {
      if (window.hljs) {
        try {
          return lang && hljs.getLanguage(lang)
            ? hljs.highlight(code, { language: lang }).value
            : hljs.highlightAuto(code).value;
        } catch {}
      }
      return code;
    }
  });

  const renderer = new marked.Renderer();

  // Add copy button to code blocks
  renderer.code = (code, lang) => {
    const langLabel = lang || 'code';
    const highlighted = window.hljs
      ? (lang && hljs.getLanguage(lang)
        ? hljs.highlight(code, { language: lang }).value
        : hljs.highlightAuto(code).value)
      : escapeHtml(code);
    const id = 'cb_' + Math.random().toString(36).slice(2, 8);
    return `<div class="code-header">
      <span>${langLabel}</span>
      <button class="copy-code-btn" onclick="copyCode('${id}')">Copy</button>
    </div><pre id="${id}"><code class="hljs">${highlighted}</code></pre>`;
  };

  marked.use({ renderer });

  return marked.parse(text);
}

function addTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typingIndicator';
  el.innerHTML = `
    <div class="msg-avatar" style="background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;">Y</div>
    <div class="typing-dots">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  document.getElementById('messages').appendChild(el);
  scrollToBottom();
  return el;
}

function removeTypingIndicator() {
  document.getElementById('typingIndicator')?.remove();
}

// Real-time streaming message element
let streamingEl = null;

function createStreamingMessage() {
  const conv = getCurrentConversation();
  if (!conv) return null;

  const tempMsg = { id: 'streaming', role: 'assistant', content: '', timestamp: Date.now() };
  const el = buildMsgElement(tempMsg);
  el.id = 'streamingMsg';
  document.getElementById('messages').appendChild(el);
  scrollToBottom();
  streamingEl = el;
  return el;
}

function updateStreamingMessage(fullText) {
  if (!streamingEl) return;
  const bubble = streamingEl.querySelector('.msg-bubble');
  if (bubble) {
    bubble.innerHTML = renderMarkdown(fullText);
    streamingEl.querySelectorAll('pre code').forEach(b => {
      if (window.hljs) hljs.highlightElement(b);
    });
  }
  scrollToBottom();
}

function finalizeStreamingMessage(fullText) {
  streamingEl?.remove();
  streamingEl = null;
}

// ==================== SEND MESSAGE ====================
async function sendMessage() {
  if (state.isLoading) return;

  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text && state.attachments.length === 0) return;

  // Build content with attachments
  let content = text;
  if (state.attachments.length > 0) {
    const attachText = state.attachments.map(a => `[Attached: ${a.name}]\n${a.content || ''}`).join('\n\n');
    content = attachText + (text ? '\n\n' + text : '');
  }

  // Check API key
  if (!state.settings.apiKey) {
    showToast('Please add your Gemini API key in Settings', 'error');
    openSettings();
    return;
  }

  // Clear input
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('charCount').textContent = '0';
  document.getElementById('sendBtn').disabled = true;
  clearAttachments();

  // Hide welcome, show messages
  document.getElementById('welcome').classList.add('hidden');

  // Add user message
  addMessage('user', content);
  renderMessages();

  // Get current conversation
  const conv = getCurrentConversation();
  const messages = conv.messages.slice(0, -1); // all except the one we're about to generate

  state.isLoading = true;
  setLoadingState(true);

  // Remove typing, add streaming bubble
  const typingEl = addTypingIndicator();

  try {
    const systemPrompt = getSystemPrompt();
    const allMessages = conv.messages.filter(m => m.role !== 'assistant' || true);

    // Try streaming first
    let fullResponse = '';
    removeTypingIndicator();
    createStreamingMessage();

    try {
      fullResponse = await callGeminiStream(
        conv.messages.slice(0, -1), // messages before the AI response
        systemPrompt,
        (chunk) => updateStreamingMessage(chunk)
      );
    } catch (streamErr) {
      // Fallback to non-streaming
      updateStreamingMessage('*Thinking...*');
      fullResponse = await callGemini(conv.messages.slice(0, -1), systemPrompt);
    }

    finalizeStreamingMessage(fullResponse);
    addMessage('assistant', fullResponse);
    renderMessages();
    renderRecentChats();

    // TTS if enabled
    if (state.settings.tts) {
      speakText(fullResponse.replace(/[#*`]/g, '').slice(0, 500));
    }

  } catch (err) {
    removeTypingIndicator();
    finalizeStreamingMessage('');
    let errMsg = err.message || 'Something went wrong';
    if (errMsg === 'NO_API_KEY') errMsg = 'Please add your Gemini API key in Settings ⚙️';
    else if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('400')) errMsg = 'Invalid API key. Check your Gemini API key in Settings.';
    else if (errMsg.includes('429')) errMsg = 'Rate limit reached. Please wait a moment before sending.';
    addMessage('assistant', `⚠️ ${errMsg}`);
    renderMessages();
    showToast(errMsg, 'error');
  } finally {
    state.isLoading = false;
    setLoadingState(false);
  }
}

function setLoadingState(loading) {
  const btn = document.getElementById('sendBtn');
  btn.disabled = loading;
}

// ==================== QUICK PROMPTS ====================
function quickPrompt(text) {
  const input = document.getElementById('msgInput');
  input.value = text;
  handleInputChange(input);
  input.focus();
  sendMessage();
}

// ==================== NEW CHAT ====================
function newChat() {
  state.currentConversationId = null;
  renderMessages();
  renderRecentChats();
  switchMode('chat');
  document.getElementById('msgInput').focus();
}

// ==================== CLEAR CHAT ====================
function clearChat() {
  const conv = getCurrentConversation();
  if (!conv) return;
  if (!confirm('Clear this conversation?')) return;
  conv.messages = [];
  conv.updatedAt = Date.now();
  saveState();
  renderMessages();
  showToast('Chat cleared', 'success');
}

// ==================== COPY & SPEAK ====================
function copyMessage(msgId) {
  const conv = getCurrentConversation();
  if (!conv) return;
  const msg = conv.messages.find(m => m.id === msgId);
  if (!msg) return;
  navigator.clipboard.writeText(msg.content).then(() => showToast('Copied to clipboard!', 'success'));
}

function copyCode(blockId) {
  const el = document.getElementById(blockId);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => showToast('Code copied!', 'success'));
}

function speakMessage(msgId) {
  const conv = getCurrentConversation();
  if (!conv) return;
  const msg = conv.messages.find(m => m.id === msgId);
  if (!msg) return;
  speakText(msg.content.replace(/[#*`]/g, ''));
}

// ==================== VOICE INPUT ====================
function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return false;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    state.isRecording = true;
    document.getElementById('voiceBtn').classList.add('active');
    document.getElementById('recordingPill').classList.remove('hidden');
  };

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(r => r[0].transcript).join('');
    const input = document.getElementById('msgInput');
    input.value = transcript;
    handleInputChange(input);
  };

  recognition.onerror = () => {
    stopVoice();
    showToast('Voice recognition error', 'error');
  };

  recognition.onend = () => stopVoice();
  return true;
}

function toggleVoice() {
  if (state.isRecording) {
    recognition?.stop();
    stopVoice();
  } else {
    if (!recognition && !initVoice()) {
      showToast('Voice input not supported in this browser', 'error');
      return;
    }
    try {
      recognition.start();
    } catch (e) {
      showToast('Could not start voice input', 'error');
    }
  }
}

function stopVoice() {
  state.isRecording = false;
  document.getElementById('voiceBtn').classList.remove('active');
  document.getElementById('recordingPill').classList.add('hidden');
}

// ==================== TEXT TO SPEECH ====================
function speakText(text) {
  if (!speechSynth) return;
  speechSynth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0;
  utter.pitch = 1.0;
  speechSynth.speak(utter);
}

function stopSpeaking() {
  speechSynth?.cancel();
}

// ==================== VOICE CALL MODE ====================
function startVoiceCall() {
  state.isCallActive = true;
  state.callMicActive = false;
  document.getElementById('callModal').classList.add('open');
  document.getElementById('callStatus').textContent = 'YourAI';
  document.getElementById('callSubStatus').textContent = 'Tap mic to start speaking';
  document.getElementById('callTranscript').textContent = '';
}

function endVoiceCall() {
  state.isCallActive = false;
  stopCallMic();
  stopSpeaking();
  closeModal('callModal');
}

function toggleCallMic() {
  if (state.callMicActive) stopCallMic();
  else startCallMic();
}

function startCallMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voice not supported', 'error'); return; }

  callRecognition = new SR();
  callRecognition.lang = 'en-US';
  callRecognition.continuous = false;
  callRecognition.interimResults = false;

  callRecognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('callTranscript').innerHTML =
      `<strong>You:</strong> ${transcript}`;
    document.getElementById('callSubStatus').textContent = 'YourAI is thinking...';

    // Call AI
    if (!state.settings.apiKey) {
      speakText('Please add your API key in settings.');
      document.getElementById('callSubStatus').textContent = 'API key missing';
      return;
    }

    try {
      addMessage('user', transcript);
      const conv = getCurrentConversation() || createConversation(transcript);
      const response = await callGemini(conv.messages.slice(0, -1), getSystemPrompt());
      addMessage('assistant', response);
      renderMessages();
      renderRecentChats();

      const shortResponse = response.replace(/[#*`]/g, '').slice(0, 600);
      document.getElementById('callTranscript').innerHTML =
        `<strong>You:</strong> ${transcript}<br><br><strong>YourAI:</strong> ${shortResponse}`;
      document.getElementById('callSubStatus').textContent = 'Speaking...';
      speakText(shortResponse);
    } catch (e) {
      speakText('Sorry, there was an error processing your request.');
      document.getElementById('callSubStatus').textContent = 'Error occurred';
    }
  };

  callRecognition.onend = () => {
    state.callMicActive = false;
    document.getElementById('callMuteBtn').classList.remove('active');
    document.getElementById('callSubStatus').textContent = 'Tap mic to speak again';
  };

  callRecognition.onerror = () => stopCallMic();

  callRecognition.start();
  state.callMicActive = true;
  document.getElementById('callMuteBtn').classList.add('active');
  document.getElementById('callSubStatus').textContent = 'Listening...';
}

function stopCallMic() {
  callRecognition?.stop();
  callRecognition = null;
  state.callMicActive = false;
  document.getElementById('callMuteBtn')?.classList.remove('active');
}

function toggleCallSpeaker() {
  state.callSpeakerActive = !state.callSpeakerActive;
  document.getElementById('callSpeakerBtn').classList.toggle('active', state.callSpeakerActive);
  if (!state.callSpeakerActive) stopSpeaking();
}

// ==================== FILE ATTACHMENTS ====================
function handleFileUpload(file) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showToast('File too large (max 10MB)', 'error');
    return;
  }

  const attachment = { name: file.name, type: file.type, content: '' };

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      attachment.content = `[Image uploaded: ${file.name}]`;
      state.attachments.push(attachment);
      renderAttachments();
    };
    reader.readAsDataURL(file);
  } else if (file.type.startsWith('text/') || isTextFile(file.name)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      attachment.content = e.target.result.slice(0, 8000); // Limit content
      state.attachments.push(attachment);
      renderAttachments();
    };
    reader.readAsText(file);
  } else {
    attachment.content = `[File attached: ${file.name} (${formatFileSize(file.size)})]`;
    state.attachments.push(attachment);
    renderAttachments();
  }
}

function isTextFile(name) {
  return /\.(txt|md|js|ts|py|html|css|json|csv|xml|yaml|yml|sh|bat|sql|php|rb|go|rs|java|c|cpp|h)$/i.test(name);
}

function renderAttachments() {
  const el = document.getElementById('attachPreview');
  el.innerHTML = state.attachments.map((a, i) => `
    <div class="attach-chip">
      📎 ${escapeHtml(a.name)}
      <button onclick="removeAttachment(${i})">×</button>
    </div>
  `).join('');
}

function removeAttachment(i) {
  state.attachments.splice(i, 1);
  renderAttachments();
}

function clearAttachments() {
  state.attachments = [];
  renderAttachments();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1048576).toFixed(1) + 'MB';
}

// ==================== RESEARCH MODE ====================
async function runResearch() {
  const query = document.getElementById('researchQuery').value.trim();
  if (!query) { showToast('Enter a research query', 'error'); return; }

  if (!state.settings.apiKey) {
    showToast('Please add your Gemini API key in Settings', 'error');
    openSettings();
    return;
  }

  const depth = document.getElementById('researchDepth').value;
  const resultEl = document.getElementById('researchResult');

  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;color:var(--text-muted);">
      <div class="spinner"></div>
      Researching: <em>${escapeHtml(query)}</em>...
    </div>
  `;

  try {
    const systemPrompt = getResearchSystemPrompt(depth);
    const messages = [{ role: 'user', content: query }];
    const result = await callGemini(messages, systemPrompt);
    resultEl.innerHTML = renderMarkdown(result);
    resultEl.querySelectorAll('pre code').forEach(b => {
      if (window.hljs) hljs.highlightElement(b);
    });

    // Also save to chat history
    if (!state.currentConversationId) createConversation(query);
    addMessage('user', `[Research] ${query}`);
    addMessage('assistant', result);
    renderRecentChats();
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--red);">⚠️ ${escapeHtml(err.message)}</p>`;
    showToast(err.message, 'error');
  }
}

// ==================== IMAGE GENERATION ====================
async function generateImage() {
  const prompt = document.getElementById('imagePrompt').value.trim();
  if (!prompt) { showToast('Describe your image first', 'error'); return; }

  const style = document.getElementById('imageStyle').value;
  const ratio = document.getElementById('imageRatio').value.split('x');
  const width = parseInt(ratio[0]);
  const height = parseInt(ratio[1]);

  const resultEl = document.getElementById('imageResult');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;color:var(--text-muted);padding:20px 0;">
      <div class="spinner"></div>
      Generating your image...
    </div>
  `;

  try {
    const imageUrl = await generateImageFromPrompt(prompt, style, width, height);

    // Pre-load image
    const img = new Image();
    img.onload = () => {
      resultEl.innerHTML = `
        <img src="${imageUrl}" alt="${escapeHtml(prompt)}" style="width:100%;max-width:512px;border-radius:12px;display:block;margin:0 auto 16px;border:1px solid var(--border);">
        <div class="image-result-actions">
          <a href="${imageUrl}" target="_blank" download="yourAI-image.jpg" class="secondary-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </a>
          <button class="secondary-btn" onclick="generateImage()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
            Regenerate
          </button>
        </div>
      `;
    };
    img.onerror = () => {
      resultEl.innerHTML = `<p style="color:var(--red);">⚠️ Failed to generate image. Try a different prompt.</p>`;
    };
    img.src = imageUrl;
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--red);">⚠️ ${escapeHtml(err.message)}</p>`;
  }
}

// ==================== EMAIL GENERATION ====================
async function generateEmail() {
  const type = document.getElementById('emailType').value;
  const tone = document.getElementById('emailTone').value;
  const recipient = document.getElementById('emailRecipient').value;
  const sender = document.getElementById('emailSender').value || state.userProfile.name || '';
  const context = document.getElementById('emailContext').value;

  if (!context.trim()) { showToast('Add some context for the email', 'error'); return; }

  if (!state.settings.apiKey) {
    showToast('Please add your Gemini API key in Settings', 'error');
    openSettings();
    return;
  }

  const resultEl = document.getElementById('emailResult');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `<div class="result-box-header">
    <span>Generating email...</span><div class="spinner"></div>
  </div>`;

  const prompt = `Write a ${tone} ${type} email.
${recipient ? `To: ${recipient}` : ''}
${sender ? `From: ${sender}` : ''}
Context: ${context}

Format the email properly with Subject line, greeting, body, and sign-off.`;

  try {
    const systemPrompt = `You are an expert email writer. Write professional, well-structured emails. Include: Subject line, proper greeting, clear body, and appropriate sign-off.`;
    const result = await callGemini([{ role: 'user', content: prompt }], systemPrompt);

    resultEl.innerHTML = `
      <div class="result-box-header">
        <span>📧 Generated Email — ${type}</span>
        <button class="copy-code-btn" onclick="copyResultBox('emailResultContent')">Copy Email</button>
      </div>
      <div class="result-box-content" id="emailResultContent">${escapeHtml(result)}</div>
    `;
  } catch (err) {
    resultEl.innerHTML = `<div class="result-box-content" style="color:var(--red);">⚠️ ${escapeHtml(err.message)}</div>`;
    showToast(err.message, 'error');
  }
}

// ==================== VIDEO SCRIPT GENERATION ====================
async function generateVideoScript() {
  const topic = document.getElementById('videoTopic').value.trim();
  if (!topic) { showToast('Enter a video topic', 'error'); return; }

  if (!state.settings.apiKey) {
    showToast('Please add your Gemini API key in Settings', 'error');
    openSettings();
    return;
  }

  const type = document.getElementById('videoType').value;
  const duration = document.getElementById('videoDuration').value;
  const audience = document.getElementById('videoAudience').value;
  const cta = document.getElementById('videoCTA').value;

  const resultEl = document.getElementById('videoResult');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `<div class="result-box-header"><span>Writing script...</span><div class="spinner"></div></div>`;

  const prompt = `Write a complete video script for a ${type} about: "${topic}"
Duration: ${duration}
${audience ? `Target audience: ${audience}` : ''}
${cta ? `Call to action: ${cta}` : ''}

Include: Hook, intro, main sections with timestamps, transitions, B-roll suggestions, and outro.`;

  try {
    const systemPrompt = `You are a professional video scriptwriter with expertise in YouTube, TikTok, and content creation. Write engaging, well-structured scripts with hooks, pacing notes, and clear timestamps.`;
    const result = await callGemini([{ role: 'user', content: prompt }], systemPrompt);

    resultEl.innerHTML = `
      <div class="result-box-header">
        <span>🎬 ${type} Script — ${topic.slice(0, 30)}${topic.length > 30 ? '...' : ''}</span>
        <button class="copy-code-btn" onclick="copyResultBox('videoResultContent')">Copy Script</button>
      </div>
      <div class="result-box-content" id="videoResultContent">${escapeHtml(result)}</div>
    `;
  } catch (err) {
    resultEl.innerHTML = `<div class="result-box-content" style="color:var(--red);">⚠️ ${escapeHtml(err.message)}</div>`;
    showToast(err.message, 'error');
  }
}

// ==================== PROFILE ====================
function loadProfileForm() {
  const p = state.userProfile;
  const setValue = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setValue('pName', p.name);
  setValue('pRole', p.role);
  setValue('pBio', p.bio);
  setValue('pInterests', p.interests);
  setValue('pGithub', p.github);
  setValue('pLinkedin', p.linkedin);
  setValue('pTwitter', p.twitter);
  setValue('pInstagram', p.instagram);
  setValue('pWebsite', p.website);
  setValue('pLinktree', p.linktree);

  // Also pre-fill email sender
  const emailSender = document.getElementById('emailSender');
  if (emailSender && !emailSender.value) emailSender.placeholder = p.name || 'Auto-filled from profile';

  // Update display
  const nameEl = document.getElementById('profileNameLarge');
  const bioEl = document.getElementById('profileBioLarge');
  const avatarEl = document.getElementById('profileAvatarLarge');

  if (nameEl) nameEl.textContent = p.name || 'Your Profile';
  if (bioEl) bioEl.textContent = p.bio || 'Set up your profile to personalize YourAI';
  if (avatarEl) avatarEl.textContent = p.name ? p.name[0].toUpperCase() : '?';
}

function saveProfile() {
  const getValue = (id) => document.getElementById(id)?.value?.trim() || '';

  state.userProfile = {
    name: getValue('pName'),
    role: getValue('pRole'),
    bio: getValue('pBio'),
    interests: getValue('pInterests'),
    github: getValue('pGithub'),
    linkedin: getValue('pLinkedin'),
    twitter: getValue('pTwitter'),
    instagram: getValue('pInstagram'),
    website: getValue('pWebsite'),
    linktree: getValue('pLinktree')
  };

  saveState();
  updateUserDisplay();
  loadProfileForm();
  showToast('Profile saved! YourAI now knows you better.', 'success');
}

async function analyzeProfile() {
  if (!state.settings.apiKey) {
    showToast('Please add your Gemini API key in Settings', 'error');
    openSettings();
    return;
  }

  // Save current form values first
  saveProfile();

  const p = state.userProfile;
  const links = [p.github, p.linkedin, p.twitter, p.instagram, p.website, p.linktree]
    .filter(Boolean).join(', ');

  if (!p.name && !p.bio) {
    showToast('Fill in your profile details first', 'error');
    return;
  }

  const resultEl = document.getElementById('profileAnalysis');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `<div class="result-box-header"><span>Analyzing your profile...</span><div class="spinner"></div></div>`;

  const prompt = `Analyze this person's profile and provide deep insights about their personality, strengths, potential blind spots, career trajectory, and personalized recommendations for growth.

Name: ${p.name || 'Not provided'}
Role: ${p.role || 'Not provided'}
Bio: ${p.bio || 'Not provided'}
Interests: ${p.interests || 'Not provided'}
Social/Web: ${links || 'Not provided'}

Provide: personality analysis, top strengths, potential areas for growth, career insights, and 5 specific actionable recommendations.`;

  try {
    const result = await callGemini(
      [{ role: 'user', content: prompt }],
      'You are YourAI, a personal growth and personality coach. Analyze profiles with empathy and depth, like a combination of a career coach and personality psychologist.'
    );

    resultEl.innerHTML = `
      <div class="result-box-header">
        <span>🧠 Your AI Profile Analysis</span>
        <button class="copy-code-btn" onclick="copyResultBox('profileAnalysisContent')">Copy</button>
      </div>
      <div class="result-box-content" id="profileAnalysisContent">${renderMarkdown(result)}</div>
    `;
    resultEl.querySelectorAll('pre code').forEach(b => {
      if (window.hljs) hljs.highlightElement(b);
    });
  } catch (err) {
    resultEl.innerHTML = `<div class="result-box-content" style="color:var(--red);">⚠️ ${escapeHtml(err.message)}</div>`;
  }
}

// ==================== MODE SWITCHING ====================
function switchMode(mode) {
  state.currentMode = mode;

  const panelMap = {
    chat: 'chatPanel',
    research: 'researchPanel',
    image: 'imagePanel',
    email: 'emailPanel',
    video: 'videoPanel',
    profile: 'profilePanel',
    history: 'historyPanel'
  };

  const titleMap = {
    chat: 'Chat',
    research: 'Research',
    image: 'Image Generator',
    email: 'Email Drafts',
    video: 'Video Scripts',
    profile: 'My Profile',
    history: 'History'
  };

  // Show/hide input area
  const inputArea = document.getElementById('inputArea');
  inputArea.style.display = (mode === 'chat' || mode === 'research') ? 'block' : 'none';

  // Show correct panel
  showPanel(panelMap[mode] || 'chatPanel');
  updatePageTitle(titleMap[mode] || 'Chat');
  updateNavActive(mode);

  // Mode-specific setup
  if (mode === 'profile') loadProfileForm();
  if (mode === 'history') renderHistoryPanel();
  if (mode === 'research') {
    document.getElementById('msgInput').placeholder = 'Research topic...';
    document.getElementById('sendBtn').onclick = () => {
      const q = document.getElementById('msgInput').value;
      if (q) { document.getElementById('researchQuery').value = q; runResearch(); }
    };
  } else {
    document.getElementById('msgInput').placeholder = 'Message YourAI...';
    document.getElementById('sendBtn').onclick = sendMessage;
  }

  closeSidebar();
}

function showPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(panelId)?.classList.add('active');
}

function updatePageTitle(title) {
  document.getElementById('pageTitle').textContent = title;
}

function updateNavActive(mode) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

// ==================== SIDEBAR ====================
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('visible');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('visible');
}

// ==================== SETTINGS ====================
function openSettings() {
  document.getElementById('apiKeyInput').value = state.settings.apiKey || '';
  document.getElementById('settingsModel').value = state.settings.model;
  document.getElementById('ttsToggle').checked = state.settings.tts;
  document.getElementById('darkOpt').classList.toggle('active', state.settings.theme === 'dark');
  document.getElementById('lightOpt').classList.toggle('active', state.settings.theme === 'light');
  document.getElementById('settingsModal').classList.add('open');
}

function saveSettings() {
  state.settings.apiKey = document.getElementById('apiKeyInput').value.trim();
  state.settings.model = document.getElementById('settingsModel').value;
  state.settings.tts = document.getElementById('ttsToggle').checked;
  document.getElementById('modelSelect').value = state.settings.model;
  saveState();
  closeModal('settingsModal');
  showToast('Settings saved!', 'success');
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('apiKeyInput');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function setTheme(theme) {
  state.settings.theme = theme;
  applyTheme(theme);
  document.getElementById('darkOpt').classList.toggle('active', theme === 'dark');
  document.getElementById('lightOpt').classList.toggle('active', theme === 'light');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const hlLink = document.getElementById('hlTheme');
  if (hlLink) {
    hlLink.href = theme === 'dark'
      ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
      : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
  }
}

function toggleTheme() {
  const newTheme = state.settings.theme === 'dark' ? 'light' : 'dark';
  state.settings.theme = newTheme;
  applyTheme(newTheme);
  saveState();
}

function changeModel(model) {
  state.settings.model = model;
  saveState();
  showToast(`Model: ${model}`, 'success');
}

function clearAllData() {
  if (!confirm('This will permanently delete all your conversations and settings. Continue?')) return;
  localStorage.removeItem(APP_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = 'index.html';
}

// ==================== RENDER UI ELEMENTS ====================
function renderRecentChats() {
  const el = document.getElementById('recentChats');
  if (!el) return;

  const recent = state.conversations.slice(0, 12);
  if (recent.length === 0) {
    el.innerHTML = `<p style="font-size:0.75rem;color:var(--text-dim);padding:8px 10px;">No conversations yet</p>`;
    return;
  }

  el.innerHTML = recent.map(conv => `
    <div class="history-item ${conv.id === state.currentConversationId ? 'active' : ''}" onclick="loadConversation('${conv.id}')">
      <span class="history-item-text">${escapeHtml(conv.title)}</span>
      <button class="history-item-del" onclick="deleteConversation('${conv.id}', event)" title="Delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  `).join('');
}

function renderHistoryPanel() {
  const el = document.getElementById('historyList');
  if (!el) return;

  if (state.conversations.length === 0) {
    el.innerHTML = `<p style="color:var(--text-muted);font-size:0.875rem;">No conversations yet. Start chatting!</p>`;
    return;
  }

  el.innerHTML = state.conversations.map(conv => `
    <div class="history-card" onclick="loadConversation('${conv.id}')">
      <div class="history-card-title">${escapeHtml(conv.title)}</div>
      <div class="history-card-meta">
        <span>${conv.messages.length} messages</span>
        <span>${formatDate(conv.updatedAt)}</span>
      </div>
      <div class="history-card-meta" style="margin-top:4px;">
        <span style="color:var(--accent-light);font-size:0.72rem;">${conv.model || 'gemini-1.5-flash'}</span>
      </div>
      <div class="history-card-actions">
        <button class="history-card-del" onclick="deleteConversation('${conv.id}', event)">Delete</button>
      </div>
    </div>
  `).join('');
}

function updateUserDisplay() {
  const p = state.userProfile;
  const name = p.name || 'User';
  const initial = name[0].toUpperCase();

  const userNameEl = document.getElementById('userName');
  const userAvatarEl = document.getElementById('userAvatar');
  const profileAvatarEl = document.getElementById('profileAvatarLarge');

  if (userNameEl) userNameEl.textContent = name;
  if (userAvatarEl) userAvatarEl.textContent = initial;
  if (profileAvatarEl) profileAvatarEl.textContent = initial;

  // Update welcome message
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const welcomeMsg = document.getElementById('welcomeMsg');
  if (welcomeMsg) welcomeMsg.textContent = `${greeting}, ${name}! How can I help?`;
}

// ==================== INPUT HANDLING ====================
function handleInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function handleInputChange(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  const len = el.value.length;
  document.getElementById('charCount').textContent = len > 0 ? len : '0';
  document.getElementById('sendBtn').disabled = el.value.trim().length === 0;
}

function insertTemplate(type) {
  const templates = {
    email: 'Write a professional email to ',
    code: 'Write a function in JavaScript that ',
    summarize: 'Summarize the following text:\n\n'
  };
  const input = document.getElementById('msgInput');
  input.value = templates[type] || '';
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  handleInputChange(input);
}

// ==================== MODALS ====================
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
  }
});

// ==================== UTILITIES ====================
function scrollToBottom() {
  const el = document.getElementById('messages');
  if (el) el.scrollTop = el.scrollHeight;
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

function copyResultBox(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => showToast('Copied!', 'success'));
}

// ==================== INIT ====================
function init() {
  // Redirect to index if not logged in
  const user = localStorage.getItem(USER_KEY);
  if (!user || !JSON.parse(user)?.name) {
    window.location.href = 'index.html';
    return;
  }

  loadState();

  // Set initial model select
  const modelSelect = document.getElementById('modelSelect');
  if (modelSelect) modelSelect.value = state.settings.model;

  // Apply theme
  applyTheme(state.settings.theme);

  // Update user display
  updateUserDisplay();

  // Render recent chats in sidebar
  renderRecentChats();

  // Set up file input
  document.getElementById('fileInput').addEventListener('change', (e) => {
    const files = e.target.files;
    for (const file of files) handleFileUpload(file);
    e.target.value = ''; // Reset input
  });

  // Init voice recognition
  initVoice();

  // Focus input
  document.getElementById('msgInput').focus();

  // First visit: prompt to set API key if not set
  if (!state.settings.apiKey) {
    setTimeout(() => {
      showToast('Add your Gemini API key in Settings to start!', 'error');
    }, 1000);
  }

  console.log('YourAI initialized ✨');
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
