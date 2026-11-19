// Command line: Facebook Pages, posts, groups, reels and comments to CSV or JSON lines.
//
//     npx facebook-scraper-api page nasa
//     npx facebook-scraper-api posts nasa --pages 3 --limit 9 --out nasa.csv
//     npx facebook-scraper-api comments https://www.facebook.com/nasa/posts/123 --format jsonl
//
// The API key comes from --token or the SOCIALAPIS_TOKEN environment variable.

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { FacebookScraperAPI, toCsv, VERSION } from "./index.js";

const HELP = `facebook-scraper-api ${VERSION}: public Facebook data without a login or browser

Usage:
  facebook-scraper-api page <Page URL | username>          details (JSON)
  facebook-scraper-api group <group URL | id>              details (JSON)
  facebook-scraper-api posts <Page URL | username>         Page posts
  facebook-scraper-api group-posts <group URL | id>        group posts
  facebook-scraper-api reels <Page URL | username>
  facebook-scraper-api videos <Page URL | username>
  facebook-scraper-api comments <post URL>
  facebook-scraper-api search-posts <keyword>
  facebook-scraper-api search-pages <keyword>

Options:
  --pages <n>        API calls to make (default 1)
  --limit <n>        posts per call, 3-9 (posts / group-posts; cost round(limit / 3) credits per call)
  --after <time>     only posts after this time (ISO 8601)
  --before <time>    only posts before this time (ISO 8601)
  --format <f>       csv (default) or jsonl
  --out <file>       file to write (default: standard output)
  --token <key>      SocialAPIs API key (default: $SOCIALAPIS_TOKEN)

Free API key (200 calls/month): https://socialapis.io/auth/signup`;

export async function main(argv = process.argv.slice(2), out = process.stdout) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      pages: { type: "string", default: "1" },
      limit: { type: "string" },
      after: { type: "string" },
      before: { type: "string" },
      format: { type: "string", default: "csv" },
      out: { type: "string" },
      token: { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  if (values.version) return void out.write(`${VERSION}\n`);
  const [command, target] = positionals;
  if (values.help || !command) return void out.write(`${HELP}\n`);
  if (!target) throw new RangeError(`${command} needs an argument (see --help)`);
  if (!["csv", "jsonl"].includes(values.format)) throw new RangeError("--format is csv or jsonl");

  const fb = new FacebookScraperAPI({ apiToken: values.token });
  if (command === "page" || command === "group") {
    const info = command === "page" ? await fb.getPageInfo(target) : await fb.getGroupInfo(target);
    return void out.write(`${JSON.stringify(info, null, 2)}\n`);
  }

  const pages = Number(values.pages);
  const postOptions = {
    pages,
    limit: values.limit === undefined ? undefined : Number(values.limit),
    after: values.after,
    before: values.before,
  };
  const listings = {
    posts: () => fb.getPosts(target, postOptions),
    "group-posts": () => fb.getGroupPosts(target, postOptions),
    reels: () => fb.getReels(target, { pages }),
    videos: () => fb.getVideos(target, { pages }),
    comments: () => fb.getComments(target, { pages }),
    "search-posts": () => fb.searchPosts(target, { pages }),
    "search-pages": () => fb.searchPages(target, { pages }),
  };
  if (!listings[command]) throw new RangeError(`unknown command "${command}" (see --help)`);

  const records = [];
  for await (const record of listings[command]()) records.push(record);
  const text = values.format === "csv" ? toCsv(records) : records.map((r) => `${JSON.stringify(r)}\n`).join("");
  if (values.out) {
    writeFileSync(values.out, text);
    process.stderr.write(`${records.length} rows written to ${values.out}\n`);
  } else {
    out.write(text);
  }
}
