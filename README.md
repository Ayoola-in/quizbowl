# Quizr

A professional, single-device web application for managing university engineering department quiz competitions.

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
