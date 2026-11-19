# facebook-scraper-js

[![facebook-scraper-api on npm](https://img.shields.io/npm/v/facebook-scraper-api?label=facebook-scraper-api&logo=npm)](https://www.npmjs.com/package/facebook-scraper-api)
[![npm](https://img.shields.io/npm/v/socialapis-sdk?cacheSeconds=300&label=npm&logo=npm)](https://www.npmjs.com/package/socialapis-sdk)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-blue.svg)](https://nodejs.org)

> Modern TypeScript/JavaScript alternative to abandoned Node.js Facebook scrapers — `facebook-scraper-with-puppeteer`, `node-facebook-scraper`, and the long tail of dead packages that broke when Meta last changed their interface. Hosted backend means it doesn't break next time either, **and you don't need Instagram credentials, OAuth tokens, or Puppeteer at all**.

This repo ships the **`facebook-scraper-api`** package: Page details, Page and group posts, reels, videos, comments and search, with pagination handled for you and a command-line tool. TypeScript types included.

```bash
npm install facebook-scraper-api
export SOCIALAPIS_TOKEN=your_key
```

```js
import { FacebookScraperAPI } from "facebook-scraper-api";

const fb = new FacebookScraperAPI(); // or new FacebookScraperAPI({ apiToken: "..." })
const page = await fb.getPageInfo("EngenSA");
console.log(page.title, page.followers_count);

// Follows the cursor: 1 API call per page, stops when there are no more posts
for await (const post of fb.getPosts("EngenSA", { pages: 2, limit: 9 })) {
  console.log(post);
}
```

```bash
npx facebook-scraper-api posts EngenSA --pages 3 --limit 9 --out posts.csv
npx facebook-scraper-api comments https://www.facebook.com/EngenSA/posts/123 --format jsonl
```

| Method | Returns |
|---|---|
| `getPageInfo(account)` / `getGroupInfo(group)` | Page / public group details |
| `getPosts(account, { pages, limit, after, before })` | A Page's posts, newest first (limit 3-9 per call, cost round(limit ÷ 3) credits) |
| `getGroupPosts(group, { … })` | A public group's posts |
| `getReels(account)` / `getVideos(account)` | A Page's reels / videos |
| `getPost(postUrl, { extended })` / `getComments(postUrl)` | One post / its comments |
| `searchPosts(query)` / `searchPages(query)` | Keyword search |

Listings are async generators; `pages` (default 1) caps the API calls. Failed calls (4xx / 5xx) are not charged. Need Instagram, Marketplace or the Ads Library too? Use the full SDK, [`socialapis-sdk`](https://www.npmjs.com/package/socialapis-sdk) ([source](https://github.com/SocialAPIsHub/socialapis-js)); the rest of this page shows the migration with it. Ads only: [`facebook-ads-library-api`](https://www.npmjs.com/package/facebook-ads-library-api).

**[Get a free API token →](https://socialapis.io/auth/signup)** — 200 calls/month, no credit card

---

## Why this exists

The Node.js Facebook-scraping ecosystem is a graveyard. Pick almost any popular package and you'll find:

- Last commit ~2-3 years old
- Open issues piling up about Meta's latest HTML change
- README still says "works as of 2021"
- PRs that fix one selector and break two others, sitting unmerged

If you're here because:

- Your old scraper returns empty arrays or `undefined`
- You searched for "facebook scraper node alternative" or "facebook-scraper-with-puppeteer fork"
- You're tired of running Puppeteer just to get a page's follower count
- Your scraper got blocked once Meta updated detection
- You don't want to manage Facebook OAuth, login cookies, or Graph API app review

…this is the modern replacement. Same idea (Facebook public data via Node.js) but the actual scraping runs on a hosted API ([socialapis.io](https://socialapis.io)) — so when Meta changes their HTML, **we fix it**. Your code doesn't change.

## Side-by-side migration

```ts
// BEFORE — Puppeteer-based scraping (fragile, slow, breaks on every Meta change)
import puppeteer from "puppeteer";

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto("https://www.facebook.com/EngenSA");
const data = await page.evaluate(() => {
  // ...50 lines of brittle DOM selectors...
});
await browser.close();
```

```ts
// AFTER — socialapis-sdk (one HTTP call, typed response, no browser)
import { FacebookScraper } from "socialapis-sdk";

const fb = new FacebookScraper({ apiToken: "..." });
const page = await fb.getPageInfo("EngenSA");
// page.title, page.followers_count, page.likes_count, page.bio, ...
// All typed, IDE autocomplete, no HTML parsing, no headless browser
```

`FacebookScraper` is an exact alias of `Facebook` from `socialapis-sdk` — identical class, identical methods, just a different name so your grep-replace migration stays a one-liner.

Full working example: [`examples/migrate.ts`](examples/migrate.ts).

## Method-by-method mapping

| Common Node.js scraper API | `socialapis-sdk` |
|---|---|
| `getPageInfo(page)` / scraping `<title>` + counts | `new FacebookScraper({apiToken}).getPageInfo(page)` |
| `getPagePosts(page)` / scraping post feed | `.getPagePosts(page)` |
| Page videos via scrape | `.getPageVideos(page)` |
| Group details via Puppeteer | `.getGroupDetails(group)` |
| Group posts via scrape | `.getGroupPosts(group)` |
| Meta Ad Library scraping | `.searchAds(query, { country: "US" })` |
| Marketplace scraping | `.searchMarketplace(query, { ... })` |
| Login cookies / Puppeteer auth | **Not needed** — hosted backend handles it |
| User-Agent rotation / proxy mgmt | **Not needed** — we manage the scraping infra |
| Headless browser | **Not needed** — single HTTP call |

## What you get on top of common scrapers

The hosted API exposes 35 Facebook endpoints + 13 Instagram + 3 Account, all from the same SDK. From the `FacebookScraper` (or `Facebook`) instance:

```ts
// Search — pages, people, posts, videos, locations
await fb.searchPages("marketing", { location_id: "103006566409959" });
await fb.searchPosts("nike", { recency: "last_month" });

// Meta Ads Library (full transparency data — creative, spend, impressions)
await fb.searchAds("fitness", { country: "US", activeStatus: "Active" });
await fb.getAdArchiveDetails("...", "...");

// Marketplace (listings, vehicles, rentals)
await fb.searchMarketplace("cars", {
  filter_location_latitude: "40.7142",
  filter_location_longitude: "-74.0064",
});
await fb.getListingDetails("123456789");

// Reels
await fb.getPageReels("EngenSA");
```

Full method list + TypeScript response types: [main SDK README →](https://github.com/SocialAPIsHub/socialapis-js#readme)

## Comparison at a glance

| | Typical Node scraper (Puppeteer-based) | `socialapis-sdk` (2026) |
|---|---|---|
| **Setup** | `puppeteer`, `puppeteer-extra`, stealth plugins | `npm install socialapis-sdk` |
| **Maintenance** | Mostly abandoned | Active; 7M+ calls/month in prod |
| **Reliability** | Breaks on every Meta change | Hosted backend; we absorb breakage |
| **Type hints** | Manual `interface { ... }` | Strict TypeScript types ship with the package |
| **HTTP client** | Headless browser + page evaluation | Native `fetch` |
| **Auth** | Login cookies / app review / OAuth | Single `x-api-token` header, 200 free calls/month |
| **Browser dependency** | Headless Chrome (~150MB) | None |
| **Bundle size impact** | Server-only — can't ship to browsers | Works in Node 18+, browsers, Bun, Deno |
| **Memory footprint** | ~300MB+ per Puppeteer instance | ~5MB |
| **Detection risk** | High — fingerprinted, captcha walls | None — we handle it |
| **Surface area** | Whatever you can scrape (fragile) | 35 Facebook endpoints + 13 IG + Account |

## Pricing

| Tier | Calls / month | Price |
|---|---|---|
| **Free** | 200 | $0 |
| Pro | 1,500 | $4.99 |
| Ultra | 30,000 | $49 |
| Mega | 120,000 | $179 |
| Enterprise | Custom | [Contact us](https://socialapis.io/contact-us) |

One credit per successful call. Failed calls (4xx caused by bad input) don't consume credits.

## Other resources

- **Full SDK source + docs**: [SocialAPIsHub/socialapis-js](https://github.com/SocialAPIsHub/socialapis-js)
- **Python SDK** (PyPI `socialapis-sdk`): [SocialAPIsHub/socialapis-python](https://github.com/SocialAPIsHub/socialapis-python)
- **Go SDK**: [SocialAPIsHub/socialapis-go](https://github.com/SocialAPIsHub/socialapis-go)
- **Hosted API docs**: [docs.socialapis.io](https://docs.socialapis.io)
- **Endpoint catalog (50+ endpoints)**: [socialapis.io/api-sources](https://socialapis.io/api-sources)
- **Status page**: [socialapis.io/status](https://socialapis.io/status)
- **Telegram (fastest support)**: [t.me/socialapis](https://t.me/socialapis)
- **Email**: [support@socialapis.io](mailto:support@socialapis.io)

## License

MIT — see [LICENSE](LICENSE).

The `socialapis-sdk` package this repo points at is also MIT-licensed. Both are open source; the hosted scraping API is the commercial layer.
