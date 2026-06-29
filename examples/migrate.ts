/**
 * Side-by-side migration example: Node.js Facebook scrapers → socialapis-sdk.
 *
 * Most Node Facebook scrapers (puppeteer-based, scrape-and-parse) share a
 * common shape: spin up a browser, navigate, evaluate DOM selectors, return
 * a brittle object. This example shows the modern equivalent — one HTTP
 * call, typed response, no browser, no scraping logic in your codebase.
 *
 * Run this:
 *     1. Sign up free at https://socialapis.io/auth/signup
 *     2. export SOCIALAPIS_TOKEN="<paste your token from the dashboard>"
 *     3. npm install socialapis-sdk
 *     4. npx tsx examples/migrate.ts   (or compile + run)
 */

// ---------------------------------------------------------------------------
// BEFORE — puppeteer-based scraping (abandoned packages all do something
// like this under the hood)
// ---------------------------------------------------------------------------
//
// import puppeteer from "puppeteer";
//
// const browser = await puppeteer.launch();
// const page = await browser.newPage();
// await page.goto("https://www.facebook.com/EngenSA");
// const data = await page.evaluate(() => {
//   const title = document.querySelector("h1")?.textContent;
//   // ...30 more lines of brittle DOM selectors that break weekly...
// });
// await browser.close();

// ---------------------------------------------------------------------------
// AFTER — socialapis-sdk (one HTTP call, typed, no browser)
// ---------------------------------------------------------------------------

import {
  FacebookScraper,
  InsufficientCreditsError,
  RateLimitError,
} from "socialapis-sdk";

async function main(): Promise<void> {
  const token = process.env.SOCIALAPIS_TOKEN;
  if (!token) {
    console.error(
      "Set SOCIALAPIS_TOKEN — sign up free at https://socialapis.io/auth/signup",
    );
    process.exit(1);
  }

  // FacebookScraper is an alias of Facebook from socialapis-sdk.
  // Same class, same methods, identical behaviour — just a name that
  // mirrors the Node scraper-package import convention for greppable
  // migrations.
  const fb = new FacebookScraper({ apiToken: token });

  let page;
  try {
    page = await fb.getPageInfo("EngenSA");
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.error(`Rate-limited. Wait ${err.retryAfterSeconds}s and retry.`);
      process.exit(1);
    }
    if (err instanceof InsufficientCreditsError) {
      console.error("Out of credits. Upgrade at https://socialapis.io/pricing");
      process.exit(1);
    }
    throw err;
  }

  // Same data Puppeteer would've scraped, but typed —
  // page.title not page.querySelector("h1")?.textContent
  console.log(`Page: ${page.title}`);
  console.log(`  Category: ${page.category}`);
  console.log(
    page.likes_count
      ? `  Likes:     ${page.likes_count.toLocaleString()}`
      : "  Likes:     n/a",
  );
  console.log(
    page.followers_count
      ? `  Followers: ${page.followers_count.toLocaleString()}`
      : "  Followers: n/a",
  );
  console.log(`  Bio:       ${(page.bio ?? "").slice(0, 80)}`);

  // Equivalent of `for post in scraper.getPosts(page)` — paginate via
  // cursors instead of scraping multiple pages with the browser.
  const posts = await fb.getPagePosts("EngenSA");
  const sample = (posts.data as Array<Record<string, any>> | undefined) ?? [];
  for (const post of sample.slice(0, 5)) {
    const timestamp = post.time ?? post.published_at ?? "?";
    const text = post.text ?? post.message ?? "";
    console.log(`  [${timestamp}] ${String(text).slice(0, 80)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
