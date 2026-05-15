# Opal for Windows

Opal is a personal focus assistant designed to help you stay productive by blocking distracting websites and applications during focus sessions.

> [!IMPORTANT]
> **Personal Use Only**: This application is intended for personal use and is not designed for distribution to other users.

## How it Works

Opal consists of three main components:

1.  **Desktop Application (Electron)**: A central dashboard where you can start focus sessions, manage your blocklists, and track your progress.
2.  **Local Background Service**: A lightweight HTTP server running on port `9000` that handles communication between the desktop app and the browser extension.
3.  **Browser Extension**: A Chrome/Edge extension that intercepts requests to distracting websites and displays a "Focus Interrupted" overlay if a block is active.

## Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- Google Chrome or a Chromium-based browser (Edge, Brave, etc.)

### 2. Setup the Desktop App
1.  Clone the repository or download the source code.
2.  Open a terminal in the project directory.
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Start the application:
    ```bash
    npm start
    ```

### 3. Install the Browser Extension
To block websites, you must install the Opal browser extension:

1.  In the Opal desktop app, go to **Settings** and click **Install Extension**.
2.  A folder containing the extension files will open, and Chrome will open to `chrome://extensions`.
3.  In Chrome, enable **Developer mode** (toggle in the top-right corner).
4.  Click **Load unpacked**.
5.  Select the folder that was just opened (usually located in your AppData folder, e.g., `C:\Users\<User>\AppData\Roaming\opal\opal-extension`).
6.  The extension is now installed and will stay synced with your focus sessions.

## Usage

1.  Open Opal.
2.  Choose a focus session name and duration.
3.  Select the apps and websites you want to block.
4.  Click **Start Session**.
5.  If you attempt to access a blocked site or app, Opal will show an interrupt screen to help you stay on track.

## Uninstallation

### 1. Remove the Browser Extension
1.  Open your browser and go to `chrome://extensions`.
2.  Locate **Opal Website Blocker**.
3.  Click **Remove**.

### 2. Remove the Desktop App
1.  Stop the application if it is running.
2.  In the Opal desktop app, go to **Settings** and click **Uninstall Extension** (this clears the temporary extension files from your system).
3.  Delete the project folder from your computer.
