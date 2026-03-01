# YourAI — Your Personal AI Universe

> A feature-rich, personal AI assistant dashboard combining the best of ChatGPT, Perplexity, and Gemini into one powerful interface. Built with HTML, CSS & JavaScript.

![YourAI Banner](https://image.pollinations.ai/prompt/YourAI%20personal%20AI%20dashboard%20dark%20purple%20theme%20modern%20UI?width=1200&height=400&nologo=true)

---

## ✨ Features

### 🤖 Core AI Chat
- **Real Gemini API** integration (Flash 1.5, Pro 1.5, Flash 2.0)
- **Streaming responses** — text appears word-by-word like ChatGPT
- **Markdown rendering** — code blocks, tables, bullet points, headers
- **Syntax highlighting** for 180+ programming languages (via highlight.js)
- **Chat history** saved to localStorage — conversations persist across sessions
- **Multi-model switching** — swap models mid-session

### 🔍 Research Mode (Perplexity-like)
- Structured research with Summary, Key Findings, Analysis, Takeaways
- Three depth levels: Quick Overview, Detailed Analysis, Expert Deep Dive
- Automatically saved to chat history

### 🎨 Image Generator
- **Pollinations.ai** integration — completely free, no API key needed
- 8 art styles: Photorealistic, Digital Art, Anime, Oil Painting, Watercolor, Cyberpunk, Minimalist, 3D Render
- Multiple aspect ratios (Square, Landscape, Portrait)
- One-click download

### 📧 Email Drafts
- 9 email types: Introduction, Follow-up, Job Application, Thank You, Cold Outreach, Newsletter, and more
- 6 tone options: Professional, Friendly, Formal, Casual, Urgent, Persuasive
- Auto-fills sender name from your profile

### 🎬 Video Scripts
- Supports YouTube, TikTok, Instagram Reels, Documentary, Tutorial, and more
- Duration options: Short (30-60s), Medium (3-5min), Long (10-15min)
- Complete scripts with hooks, timestamps, B-roll notes, and CTAs

### 🎤 Voice Features
- **Voice Input** — speak your messages using Web Speech API
- **Voice Call Mode** — full-screen hands-free conversation
- **Text-to-Speech** — AI responses read aloud (optional, toggle in settings)

### 👤 My Profile — YourAI Personal Context
- Personal profile setup: name, bio, role, interests
- Social links: GitHub, LinkedIn, Twitter/X, Instagram, Portfolio, Linktree
- **AI Profile Analysis** — deep personality insights and growth recommendations
- Profile context injected into ALL conversations for personalized AI

### 📎 File Attachments
- Attach text files, code files, CSVs, markdown — content included in context
- Image upload support
- File size limit display

### 🌙 UI & UX
- **Dark / Light** theme toggle
- Mobile-first responsive design with hamburger sidebar
- Animated streaming responses
- Quick action cards on welcome screen
- Copy button on every message and code block
- Auto-resizing textarea input
- Toast notifications

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/YourAI.git
cd YourAI
```

### 2. Run locally (recommended: use a local server)
See **[RUN.md](RUN.md)** for step-by-step instructions (serve with `npx serve .` or Python, optional `config.js` for API keys).

- **Quick start:** `npx serve .` then open **http://localhost:3000**
- **Optional:** Copy `config.example.js` to `config.js` and add your **Gemini API key** (and **Firebase** config for Sign in with Google). `config.js` is not committed (in `.gitignore`).

### 3. Get a free Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API key"
4. Copy the key

### 4. Add your API key to YourAI
- **Option A:** Put it in `config.js` (copy from `config.example.js`) — the dashboard will use it automatically.
- **Option B:** Open the dashboard → ⚙️ Settings → paste your API key → Save.

### 5. (Optional) Sign in with Google
1. Create a project in [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication → Sign-in method → Google**
3. Copy your app config into `config.js` as `window.FIREBASE_CONFIG` (see `config.example.js`)
4. The onboarding page will show **Sign in with Google**

---

## 📁 Project Structure

```
YourAI/
├── index.html          # Landing page + authentication
├── dashboard.html      # Main AI dashboard
├── dashboard.css       # All styles (dark/light themes, responsive)
├── dashboard.js        # Full application logic
├── signup.html         # Legacy signup page
├── signup.css          # Legacy signup styles
└── README.md           # This file
```

---

## 🛠️ Tech Stack

| Technology | Usage |
|-----------|-------|
| **HTML5** | Semantic structure |
| **CSS3** | Custom variables, Grid, Flexbox, Animations |
| **Vanilla JavaScript** | App logic, API calls, State management |
| **Google Gemini API** | AI chat, research, content generation |
| **Pollinations.ai** | Free image generation |
| **Web Speech API** | Voice input & text-to-speech |
| **marked.js** | Markdown rendering |
| **highlight.js** | Code syntax highlighting |
| **localStorage** | Data persistence |

---

## 🌿 Git Branches

| Branch | Description |
|--------|-------------|
| `main` | Stable production branch |
| `dev` | Active development branch |
| `feature/voice-call` | Voice call mode feature |
| `feature/image-gen` | Image generation feature |

---

## 🧑‍🤝‍🧑 Team & Collaborators

Built as part of the **Web3Bridge Frontend Development Assignment**.

To add collaborators on GitHub:
1. Go to your repo → Settings → Collaborators
2. Add team members by username

---

## 🔑 API Keys & Services

| Service | Key Required | Cost |
|---------|-------------|------|
| Gemini API | Yes (your own) | Free tier available |
| Pollinations.ai | No | Completely free |
| Web Speech API | No | Built into browsers |

---

## 🎯 Bonus Features Implemented

- [x] Voice input (Web Speech API)
- [x] Store chat in localStorage
- [x] Mobile-first layout
- [x] Markdown rendering with code blocks
- [x] Multi-model chat (Gemini Flash, Pro, 2.0)
- [x] Voice call mode (hands-free conversation)
- [x] Image generation (Pollinations.ai)
- [x] Email drafting
- [x] Video script writing
- [x] Personal profile with AI analysis
- [x] File/document attachments
- [x] Streaming responses
- [x] Dark/light theme
- [x] Copy message & code buttons
- [x] Chat history management

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

*Made with ❤️ by the YourAI team*
