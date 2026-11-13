# Pink Plate — Mess Meal Tracker

A local-first meal and accounts tracker for a hostel or shared mess. The manager records daily meals, reviews WhatsApp poll screenshots, tracks expenses and payments, and prepares a monthly statement for residents.

## Features

- **Dashboard:** current-month meal units, today's meal counts, residents, collections, expenses, and the calculated meal rate.
- **Residents:** add, edit, remove, or restore resident records. Registered names are kept in full; poll matching can use first names, aliases, initials, and spelling suggestions.
- **Daily meals:** record breakfast, lunch, and dinner per resident. Counts support half-meal increments and manual corrections.
- **WhatsApp poll review:** upload one or more screenshots, review detected voter rows, correct names, confirm suggested resident matches, or keep a voter unknown. Meal headings such as `Lunch:-` are detected automatically. Each screenshot's date and meal can be reviewed before applying it.
- **Monthly overview:** view residents by row and calendar days by column, with daily and monthly totals. Correct individual entries and export the view as CSV.
- **Payments and expenses:** record resident payments and general mess expenses separately from meal entries, then view balances and print or save a monthly report as PDF.
- **Local backup:** download a JSON backup containing residents, meal records, payments, and expenses.

## Run locally

This is a static browser app; no build step or backend is required.

1. Install Python 3 if it is not already available.
2. From the project folder, start a local web server:

   ```sh
   python3 -m http.server 8000
   ```

3. Open [http://localhost:8000](http://localhost:8000) in your browser.
4. Stop the server with `Ctrl+C` when finished.

Opening `index.html` directly may not work consistently because the app uses browser APIs that expect an HTTP origin.

## Using poll screenshots

1. Open **Daily meals** and choose the poll screenshot file or drag it into the upload area.
2. Set or confirm the date and meal for each screenshot.
3. Start OCR, then review every extracted row. Correct uncertain text and confirm any resident match before applying.
4. Mark unmatched voters as unknown or explicitly mark non-voter text. Unknown entries are retained for review and are not included in resident meal totals.
5. If a record already exists for the same date and meal, select the replace option only if you intend to replace it.

OCR uses Tesseract.js in the browser. The app fetches the OCR library and English language data from public CDNs, so the first OCR run needs an internet connection. Screenshot processing happens in the browser; screenshots are not uploaded to an OCR service. OCR can make mistakes, so review the result before applying it.

## Data and privacy

- Records are stored in the current browser's `localStorage` on this device. They do not automatically sync to another browser or computer.
- This version has no sign-in or server-side access control. Anyone using the same browser profile can open its records, so use a trusted device and browser profile.
- Download backups regularly and store them somewhere private. Backup files contain resident and financial records; do not commit them to Git or publish them.
- Clearing browser storage or changing browser profiles can make the app's records unavailable. Keep a backup before doing either.

## Project files

- `index.html` — app shell and page layout
- `styles.css` — Pink Plate styles and responsive layout
- `app.js` — resident, meal, poll OCR, and finance workflows

The standalone `eng.traineddata` file is not required by the current app; Tesseract downloads its language data when OCR starts.

## Current limitations

This is a single-device manager tool, not a multi-user deployment. It has no hosted database, account system, automatic synchronization, or resident login. A shared or hosted deployment would need authentication, server-side storage, backups, and access controls.
