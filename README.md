# eCourt Webscrape

A full-stack application for automating case information retrieval from eCourt systems. This project leverages Playwright for web automation and Tesseract OCR for solving CAPTCHAs, providing a seamless interface to search for cases by CNR number.

## Features

- **CNR Number Search**: Search for specific case details using the Unique Case Number (CNR).
- **Automated CAPTCHA Solving**: Integrated Tesseract OCR engine with image preprocessing (via SkiaSharp) to solve eCourt CAPTCHAs automatically using 5 different thresholding strategies.
- **Robust Scraping**: Powered by Playwright for reliable interaction with dynamic web content and multi-step form navigation.
- **Session Management**: Efficiently handles multiple concurrent browser sessions with automatic cleanup of idle resources.
- **Modern UI**: A clean, responsive frontend built with React 19 and Vite.

## How it Works

The application follows a sophisticated automated pipeline to bypass CAPTCHA hurdles and extract data:

1.  **User Input**: The process starts when a user enters a CNR number on the React frontend.
2.  **Browser Session**: The Backend (`ECourtController`) triggers `PlaywrightSessionManager` to launch a headless Chromium instance.
3.  **Target Navigation**: The browser navigates to the eCourt Services portal.
4.  **CAPTCHA Extraction**: The system identifies the `#captcha_image` element and captures it as a high-resolution screenshot.
5.  **Multi-Strategy OCR**:
    *   The `CaptchaSolverService` receives the image.
    *   It creates 5 different processed versions of the image (adjusting threshold, scaling 2x, and inverting colors) using **SkiaSharp**.
    *   **Tesseract OCR** analyzes each version. The result with the highest confidence score and valid alphanumeric length is selected.
6.  **Form Interaction**: Playwright types the CNR number and the solved CAPTCHA into the website fields and clicks 'Search'.
7.  **Data Scraping**: Once the page updates, the `CaseScraper` service parses the dynamic HTML to extract petitioner details, respondent details, and case status.
8.  **Fallback Mechanism**: If the automated OCR fails or the CAPTCHA is incorrect, the backend returns the current session ID and CAPTCHA image to the frontend, allowing for a manual retry without losing the session.
9.  **Resource Cleanup**: Sessions are automatically closed after completion or after a 5-minute idle period to save memory.

## 🛠️ Technology Stack

### Backend
- **Framework**: .NET 8.0 (ASP.NET Core Web API)
- **Automation**: [Microsoft Playwright](https://playwright.dev/dotnet/)
- **OCR Engine**: [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)
- **Image Processing**: [SkiaSharp](https://github.com/mono/SkiaSharp)
- **Documentation**: Swagger/OpenAPI

### Frontend
- **Library**: React 19
- **Build Tool**: Vite
- **Language**: JavaScript

## 📋 Prerequisites

Before running the project, ensure you have the following installed:

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js](https://nodejs.org/) (v18+) & npm
- [Tesseract OCR Data](https://github.com/tesseract-ocr/tessdata) (Ensure `eng.traineddata` is in `backend/tessdata/`)

## ⚙️ Setup & Installation

### 1. Backend Setup

Navigate to the `backend` directory:

```bash
cd backend
dotnet restore
```

Install Playwright browsers:
```bash
pwsh bin/Debug/net8.0/playwright.ps1 install
# OR if you haven't built yet
dotnet build
pwsh bin/Debug/net8.0/playwright.ps1 install
```

### 2. Frontend Setup

Navigate to the `Frontend` directory:

```bash
cd Frontend
npm install
```

##  Running the Application

### Start the Backend
```bash
cd backend
dotnet run
```
The API will typically be available at `http://localhost:5000` or `https://localhost:5001`. You can view the Swagger UI at `/swagger`.

### Start the Frontend
```bash
cd Frontend
npm run dev
```
The application will be available at `http://localhost:5173`.

## Project Structure

### Backend (`/backend`)
- **`Controllers/`**: 
    - `EcourtController.cs`: Main API entry points for search and session management.
    - `CaptchaController.cs`: Dedicated endpoints for manual CAPTCHA solving.
- **`Services/`**:
    - `PlaywrightSessionManager.cs`: Manages lifecycle of Chromium instances.
    - `CaptchaSolverService.cs`: OCR logic using SkiaSharp and Tesseract.
    - `CaseScraper.cs`: Logic for navigating and parsing the eCourt HTML structure.
- **`Models/`**: Defines the data contracts (SearchRequest, CaseDetailsResponse, etc.).
- **`tessdata/`**: Essential directory containing Tesseract language files (e.g., `eng.traineddata`).

### Frontend (`/Frontend`)
- **`src/pages/`**:
    - `CnrNumber.jsx`: Main interface for CNR search and result display.
- **`src/services/`**: API client logic to communicate with the .NET backend.

## Disclaimer

This project is for educational purposes only. Always ensure compliance with the terms of service of any website you interact with. Automated scraping of government websites may be restricted or require permission.


