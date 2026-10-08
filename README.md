# Quizr

A web app for running any kind of quiz competition (school, church, community, office or pub quizzes) with questions, teams, live scoring and an audience-facing display. Create as many quizzes as you like; each keeps its own questions, teams, history and settings.

## Features
- **Client-Side Storage**: Uses `localStorage` to operate without a backend.
- **MathJax Integration**: Render complex LaTeX mathematical equations.
- **Dynamic Question Types**: MCQ, Calculation, Theory, True/False.
- **State Management**: Track available/answered questions, team scores, and competition history.
- **Display Mode**: A full-screen projector-friendly mode to hide administrator controls.
- **Fast Client-Side Search**: Instantly find questions by keywords, topic, or ID.

## Running Locally

Because this application does not use ES Modules (`type="module"`), you can simply double-click `index.html` to open it in any modern browser!

Alternatively, you can serve it via a local development server:
```bash
# Using Node.js
npx serve .

# Using Python
python -m http.server 8000
```

## Install on a Phone (Web App)
Quizr is an installable web app (PWA). Once installed it opens from the home screen like a normal app, full screen, and **works offline**. All quizzes, questions and scores are stored on the phone itself.

Install it from the deployed **https** site (e.g. your Vercel URL). Phones only allow installing over https, so opening `index.html` as a file or over plain `http://` on your Wi-Fi will not offer the install option.

- **Android (Chrome):** open the site, then tap **Install App** in the sidebar menu, or browser menu (⋮) → **Install app** / **Add to Home screen**.
- **iPhone / iPad (Safari):** open the site, tap **Share** → **Add to Home Screen**.

Open the app once while online so everything is saved for offline use. After that it runs with no connection. Math formulas (MathJax) and fonts are also stored the first time they load online.

Notes:
- Data lives inside the installed app on that device. It is not synced between devices. On iPhone, the home screen app also keeps separate data from Safari.
- Inside the installed app, **Public Display** opens in the same window. Use the back arrow in its header to return to the admin pages.
- Updates you deploy are picked up automatically the next time the app is opened online. If you add or rename files, also add them to `APP_SHELL` in `sw.js` and bump `CACHE_VERSION`.

## AI Question Generator
Open **AI Generator** in the sidebar (or **Generate with AI** on the Questions page) to create questions from your own material:

1. **Source material**: upload PDFs, Word (.docx), PowerPoint (.pptx), OpenDocument, text/Markdown/CSV/HTML files, or photos and screenshots (paste them too). You can also paste notes, or type just a topic.
2. **AI model**: pick ChatGPT (OpenAI), Claude (Anthropic), Gemini (Google), OpenRouter (Llama, DeepSeek, Mistral, Grok and many more) or any OpenAI-compatible server (Groq, DeepSeek, Mistral, xAI, Together, or a local Ollama / LM Studio). Paste your API key from that service. **Load my models** lists every model your key can use.
3. **Questions**: choose how many multiple-choice, true/false, short-answer and calculation questions; options per multiple-choice question (2–6); difficulty; audience; language; an optional fixed category; and extra instructions.
4. **Review**: edit or untick questions, then add them. They always go into the quiz you were in when you uploaded, with that quiz's default marks.

Notes:
- **Your API key** is stored only in this browser and sent only to the service you choose. Usage is billed to your account with that service.
- **Quality checks**: questions are checked before you see them. Broken or duplicate questions are dropped and replaced, and multiple-choice answers are shuffled so the correct letter varies. Questions already in the quiz are not repeated (optional).
- **Explanations** (optional) appear under the answer on the public display.
- **Scanned PDFs** are read as page pictures, using up to the first 12 pages.
- **Old file formats** (.doc, .ppt, .xls) aren't supported. Save them as PDF or the newer format first.
- **Large requests**: up to 100 questions per run, generated in batches of 15.

## Adding Questions
Click **Questions** on the sidebar, then click **+ Add Question**. Enter the question details. You can use standard LaTeX syntax wrapped in `$$` for block math or `\\(` `\\)` for inline math.

## Display Mode
Click the **Display Mode** button in the top right corner. This will expand the main view and hide the sidebar, header, and administrative scoring controls, making it perfect for projecting onto a screen for the audience.
Press `ESC` to exit Display Mode.

## Keyboard Shortcuts
| Where | Key | Action |
|---|---|---|
| Admin | `Ctrl+K` | Focus question search |
| Admin | `Alt+N` | Add a new question |
| Admin | `Esc` | Exit Display Mode |
| Public Display | `Enter` | Show the typed question number |
| Public Display | `A` | Reveal / hide the answer |
| Public Display | `F` | Toggle fullscreen |
| Public Display | `Esc` | Close question / celebration |

The sun/moon button in the header toggles dark mode (shared by the admin and public pages).

## Vercel Deployment
This project is configured as a static site and is ready to deploy to Vercel.
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root.

## Architecture
The application uses a modular Repository/Service pattern mapped to `window.QuizBowl`:
- `Data`: Wraps `localStorage` providing a database-like API (`questions-db.js`). This layer can be swapped out for Supabase or a SQL backend later.
- `Services`: Business logic (scoring, stats).
- `Views`: UI rendering logic.
