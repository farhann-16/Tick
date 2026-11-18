<div align="center">

# ✓ tick.

### *A little room for progress.*

A private space for the things you mean to keep doing: small returns, added up.

<br>

[![Live Demo](https://img.shields.io/badge/Live_Demo-2F5D50?style=for-the-badge&logo=githubpages&logoColor=white)](https://farhann-16.github.io/Task-Tracker)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-2F5D50?style=for-the-badge)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

</div>

---

## 📖 Overview

**tick.** is a minimal, offline-first task tracker built around two things: the **goals** you want to see through and the **daily habits** you want to keep coming back to.

No accounts. No servers. No tracking. Your data lives entirely in your browser.

Built with **zero dependencies** and **no build step**. Just three static files that run anywhere.

---

## 📸 Preview

<!-- Add your screenshots here, e.g.:
<p align="center">
  <img src="./screenshots/goals.png" width="45%" alt="Goals view" />
  <img src="./screenshots/daily.png" width="45%" alt="Daily check-in view" />
</p>
-->

> Screenshots coming soon.

---

## ✨ Features

### 🎯 Goals

- Create goals with a title and an optional target date
- Break each goal into smaller steps (subtasks)
- Tick off steps right inside the goal card
- Edit or delete goals anytime

### 🌿 Habits & Daily Check-in

- Add habits with a name, rhythm (frequency and quota), duration, and start date
- Pick the duration in days, weeks, or months
- Check off today's habits from a single **Daily** tab
- Move between days with the **◀ ▶** steppers, or jump back with **Today**
- Past check-ins are stored per date, so your history stays intact

### 🎨 Experience

- Clean, calm design with a green-toned palette
- Light and dark themes, toggled with one click
- Glassy UI using `backdrop-filter`
- Elegant type pairing: **Fraunces** for display, **DM Sans** for UI
- Fully responsive across mobile, tablet, and desktop

### 🔒 Privacy & Data

- 100% local: everything is saved in `localStorage`
- No sign-up, no analytics, no network calls for your data
- **Export** your data as a JSON backup
- **Import** a backup to restore or move to another device

---

## 🚀 Live Demo

Hosted on GitHub Pages:

**👉 [farhann-16.github.io/Task-Tracker](https://farhann-16.github.io/Task-Tracker)**

---

## 🛠️ Tech Stack

| Layer     | Technology                                               |
| --------- | -------------------------------------------------------- |
| Structure | HTML5 (semantic)                                         |
| Styling   | CSS3 (custom properties, grid, flexbox, backdrop-filter) |
| Logic     | Vanilla JavaScript (ES6+, zero dependencies)             |
| Storage   | `localStorage`                                           |
| Hosting   | GitHub Pages                                             |
| Fonts     | Fraunces (display) & DM Sans (UI) via Google Fonts       |

---

## 📁 Project Structure

```
tick/
├── index.html      # Markup: all UI, dialogs, and semantic structure
├── style.css       # Styles: themes, layout, components, responsive rules
├── script.js       # Logic: state, rendering, persistence, interactions
└── README.md       # You're looking at it
```

No `node_modules`, no config files, no build pipeline.

---

## ⚙️ Getting Started

### Option 1: Just open it

Double-click `index.html`. It runs straight in the browser, no server needed.

### Option 2: Local server (recommended for full features)

```bash
# Clone the repo
git clone https://github.com/farhann-16/Task-Tracker.git
cd Task-Tracker

# Python 3
python -m http.server 8080

# or Node (npx)
npx serve .
```

Then visit **http://localhost:8080**.

---

## 📤 Deploy to GitHub Pages

tick. is 100% static, so it's a perfect fit for GitHub Pages.

1. Push the project to a GitHub repository
2. Go to **Settings → Pages**
3. Under **Source**, choose **Deploy from a branch**
4. Select your branch (e.g. `main`) and the `/ (root)` folder
5. Click **Save**

Your site will be live at:

```
https://<your-username>.github.io/<repo-name>/
```

Every time you push changes, Pages redeploys automatically.

> 💡 The app uses **relative paths** (`./style.css`, `./script.js`), so it works at any sub-path without extra config.

---

## 🎮 Usage Guide

| Action            | How                                                                        |
| ----------------- | -------------------------------------------------------------------------- |
| Add a goal        | Click **Add a goal** → fill in title, optional date, optional steps → Save |
| Complete a step   | Click the checkbox next to any step inside a goal card                     |
| Add a habit       | Switch to **Daily** → **Add a habit** → set rhythm, duration, start date   |
| Check off a habit | On the **Daily** tab, click the habit's checkbox for today                 |
| Navigate dates    | Use the **◀ ▶** steppers or the **Today** button                           |
| Switch theme      | Click the 🌙/☀️ icon in the top-right                                      |
| Backup data       | Footer → **Export data** (downloads a JSON file)                           |
| Restore data      | Footer → **Import data** → select your backup JSON                         |

---

## 🗄️ Data Model

Everything is stored in `localStorage` under the key `tick.state`:

```json
{
  "goals": [
    {
      "id": "uid",
      "title": "Learn to cook",
      "targetDate": "2026-12-31",
      "subtasks": [
        { "id": "uid", "title": "Master scrambled eggs", "done": true }
      ]
    }
  ],
  "habits": [
    {
      "id": "uid",
      "name": "Read",
      "frequency": "daily",
      "quota": 4,
      "duration": 1,
      "durationUnit": "months",
      "startDate": "2026-11-01",
      "completions": { "2026-11-01": true, "2026-11-02": true }
    }
  ]
}
```

| Field          | Description                                         |
| -------------- | --------------------------------------------------- |
| `id`           | Unique ID generated for each goal, step, and habit  |
| `targetDate`   | Optional goal deadline (`YYYY-MM-DD`)               |
| `subtasks`     | Steps inside a goal, each with a `done` flag        |
| `frequency`    | How often a habit repeats                           |
| `quota`        | Target count for the chosen frequency               |
| `duration`     | How long the habit runs, paired with `durationUnit` |
| `completions`  | Map of date → `true` for every day checked off      |

---

## 💾 Backup & Restore

Since data lives in your browser, clearing site data will erase it. To stay safe:

1. Click **Export data** in the footer to download a `.json` backup
2. Keep that file somewhere safe
3. To restore, click **Import data** and select the file

---

## 🔍 Browser Support

| Browser | Version |
| ------- | ------- |
| Chrome  | 90+     |
| Firefox | 88+     |
| Safari  | 14+     |
| Edge    | 90+     |

Requires support for CSS `backdrop-filter`, CSS Grid, `localStorage`, and ES6 modules.

---

## 🤝 Contributing

Ideas and fixes are welcome.

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-idea`
3. Commit your changes: `git commit -m "Add your idea"`
4. Push: `git push origin feature/your-idea`
5. Open a Pull Request

---

## 📄 License

Released under the **MIT License**. Feel free to use, modify, and share it.

---

<div align="center">

**Created by Diwan FarhanMadar**

*Made with care, for the things worth keeping at.*

⭐ If you like tick., drop a star on the repo!

</div>
