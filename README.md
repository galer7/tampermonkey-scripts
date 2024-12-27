# Tampermonkey Scripts

This repository contains a collection of Tampermonkey scripts for various automation tasks.

## Scripts

### 1. IFlow Auto Time Entry
(`src/iflow.ts`)

A Tampermonkey script that automates time entry on the IFlow platform. It automatically:
- Opens the time entry modal
- Selects "Home" as the work location
- Fills in an 8-hour workday

### 2. Lumea Lui Banciu Video Scraper
(`src/banciu-scraping-yt.ts`)

A YouTube scraping script that:
- Scrapes videos containing "lumea lui banciu". Works with search and playlist results.
- Collects video metadata (title, channel, duration, date, URL)
- Provides UI controls for scraping automation
- Supports parallel processing and data storage

## Setup

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Install dependencies:
```bash
pnpm install
```

3. Build the scripts:
```bash
pnpm build
```

4. Copy the compiled scripts from the `dist` folder into Tampermonkey

## Development

The scripts are written in TypeScript and compiled to JavaScript. To modify:

1. Edit the source files in the `src` directory
2. Run `pnpm build` to compile
3. Update your Tampermonkey scripts with the new versions from `dist` 