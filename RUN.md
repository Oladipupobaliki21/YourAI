# How to Run YourAI on Your Local Machine

YourAI is **HTML, CSS, and JavaScript only** — no build step required. Follow these steps to run it locally.

---

## 1. Get the code

If you haven’t already:

```bash
git clone https://github.com/YOUR_USERNAME/YourAI.git
cd YourAI
```

---

## 2. (Optional) Set your API keys so you don’t type them every time

- **Copy the example config:**
  - **Windows (PowerShell):** `Copy-Item config.example.js config.js`
  - **Mac/Linux:** `cp config.example.js config.js`

- **Edit `config.js`** and add:
  - **Gemini API key** — get one at [Google AI Studio](https://aistudio.google.com/app/apikey)
  - **Firebase config** (only if you use “Sign in with Google”) — from [Firebase Console](https://console.firebase.google.com) → your project → Project settings → Your apps

`config.js` is in `.gitignore`, so it will **not** be committed or pushed. Never commit real API keys.

---

## 3. Serve the project with a local server

Opening `index.html` by double‑clicking can work, but some features (e.g. loading `config.js`, CORS) work more reliably with a local server. Use one of the options below.

### Option A: Node (npx serve)

```bash
npx serve .
```

Then open: **http://localhost:3000**

### Option B: Node (npx live-server, with auto-reload)

```bash
npx live-server
```

Then open: **http://127.0.0.1:8080**

### Option C: Python 3

```bash
python -m http.server 8000
```

Then open: **http://localhost:8000**

### Option D: Python 2

```bash
python -m http.server 8000
```

Then open: **http://localhost:8000**

---

## 4. Use the app

1. Open **http://localhost:PORT** in your browser (use the port from the command you ran).
2. On the **onboarding page**:
   - Use **Sign in with Google** (if you added Firebase config in `config.js`), or
   - Enter your name and click **Open My Dashboard** / **Create My AI Profile**.
3. On the **dashboard**:
   - If you set `GEMINI_API_KEY` in `config.js`, the app will use it automatically.
   - Otherwise, go to **Settings** (gear icon) and paste your Gemini API key there.

---

## Quick reference

| What              | Where |
|-------------------|--------|
| Landing / login   | `index.html` |
| Dashboard         | `dashboard.html` |
| App logic         | `dashboard.js` |
| Styles            | `dashboard.css` |
| Local secrets     | `config.js` (create from `config.example.js`) |
| Example config    | `config.example.js` |

---

## Troubleshooting

- **“Add your Gemini API key”**  
  Create `config.js` from `config.example.js` and set `window.GEMINI_API_KEY = 'your-key';`, or add the key in Dashboard → Settings.

- **“Sign in with Google is not configured”**  
  Add your Firebase config to `config.js` (see `config.example.js`) and enable the Google sign-in method in the Firebase Console (Authentication → Sign-in method).

- **config.js 404 in console**  
  Normal if you haven’t created `config.js`. The app still works; you can enter the Gemini key in Settings instead.

- **CORS or blank page when opening the file directly**  
  Use a local server (Step 3) instead of opening the HTML file from the file system.
