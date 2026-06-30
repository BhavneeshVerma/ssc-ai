# DRILL - Speed & Recall Trainer & AlphaNumerics Pro Trainer

This repository contains two main components to train speed and recall for alphabets, numbers, and keypads:
1. **DRILL Pro Web App** (Root directory) - A modern, high-performance Vite-based web application.
2. **AlphaNumerics Pro Trainer** (`python-desktop-app/`) - A Python Tkinter desktop application with visualization graphs.

---

## 1. How to Start the Web Application (DRILL Pro)

The web application is built using **Vite** and styled with CSS/TailwindCSS.

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation & Run Steps
1. Open your terminal in the project root directory.
2. Install the package dependencies (if they are not already installed):
   ```bash
   npm install
   ```
3. Start the Vite local development server:
   ```bash
   npm run dev
   ```
4. Open the local address provided in the terminal output (usually `http://localhost:5173`) in your web browser.

### Scripts
- `npm run dev` - Runs the development server.
- `npm run build` - Builds the production application.
- `npm run preview` - Previews the built production site locally.

---

## 2. How to Start the Desktop Application (AlphaNumerics Pro Trainer)

The desktop application is built with Python's **Tkinter** and uses `matplotlib` for analytics graphing.

### Prerequisites
Make sure you have [Python 3](https://www.python.org/) installed on your system.

### Installation & Run Steps
1. Navigate to the `python-desktop-app` directory:
   ```bash
   cd python-desktop-app
   ```
2. Install the required dependencies:
   ```bash
   pip install matplotlib
   ```
3. Run the application:
   ```bash
   python alphabet_trainer.py
   ```
