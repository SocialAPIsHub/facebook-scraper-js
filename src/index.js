// Facebook scraper API for Node.js: public Pages, posts, groups, reels,
// comments and search.
//
// The data comes from a hosted API, so nothing breaks when Facebook changes
// its pages: no login, no cookies, no Puppeteer, no proxies. Powered by
// SocialAPIs (https://socialapis.io).
//
//     import { FacebookScraperAPI } from "facebook-scraper-api";
//
//     const fb = new FacebookScraperAPI(); // reads SOCIALAPIS_TOKEN
//     console.log((await fb.getPageInfo("nasa")).followers_count);
//     for await (const post of fb.getPosts("nasa", { pages: 2 })) console.log(post);
//
// Free API key (200 calls/month, no card): https://socialapis.io/auth/signup

import { Facebook } from "socialapis-sdk";
import { itemsOf, recordOf } from "./items.js";
import { paginate } from "./paging.js";

export { flatten, itemsOf, recordOf, toCsv } from "./items.js";
export { nextCursor, paginate } from "./paging.js";
export const VERSION = "0.1.0";

export class FacebookScraperAPI {
  /**
   * @param {{ apiToken?: string, fetch?: typeof fetch, client?: Facebook }} [opts]
   *   apiToken defaults to process.env.SOCIALAPIS_TOKEN.
   */
  constructor(opts = {}) {
    if (opts.client) {
      this.fb = opts.client;
      return;
    }
    const apiToken = opts.apiToken || (typeof process !== "undefined" ? process.env.SOCIALAPIS_TOKEN : undefined);
    if (!apiToken) {
      throw new Error(
        "Pass { apiToken } or set SOCIALAPIS_TOKEN. Get a free key at https://socialapis.io/auth/signup (200 calls/month, no card).",
      );
    }
    this.fb = new Facebook({ apiToken, fetch: opts.fetch });
  }

  async *#items(call, pages, params = {}) {
    for await (const body of paginate((cursor) => call({ ...params, end_cursor: cursor ?? undefined }), pages)) {
      yield* itemsOf(body);
    }
  }

  // ---- single records ------------------------------------------------------

  /** A Page's public details: name, followers, likes, category, contact, links. */
  getPageInfo(account, extra) {
    return this.fb.getPageInfo(account, extra);
  }

  /** A public group's details: name, members, privacy, description. */
  getGroupInfo(group, extra) {
    return this.fb.getGroupDetails(group, extra);
  }

  /** One post's details ({ extended: true } adds views, video URLs, music). */
  async getPost(postUrl, { extended = false, ...extra } = {}) {
    const body = extended
      ? await this.fb.getPostDetailsExtended(postUrl, extra)
      : await this.fb.getPostDetails(postUrl, extra);
    return recordOf(body);
  }

  // ---- listings (async generators, 1 API call per page) ----------------------

  /**
   * Recent posts of a Page, newest first. `limit` is posts per call (3-9,
   * default 3; cost round(limit / 3) credits per call); `after` / `before` are
   * ISO 8601 timestamps.
   */
  getPosts(account, options = {}) {
    return this.#posts((p) => this.fb.getPagePosts(account, p), options);
  }

  /** Recent posts of a public group. Same options as getPosts. */
  getGroupPosts(group, options = {}) {
    return this.#posts((p) => this.fb.getGroupPosts(group, p), options);
  }

  #posts(call, { pages = 1, limit, after, before, ...extra }) {
    if (limit !== undefined && !(Number.isInteger(limit) && limit >= 3 && limit <= 9)) {
      throw new RangeError("limit is posts per call, from 3 to 9");
    }
    return this.#items(call, pages, { ...extra, limit, after_time: after, before_time: before });
  }

  /** A Page's reels. */
  getReels(account, { pages = 1, ...extra } = {}) {
    return this.#items((p) => this.fb.getPageReels(account, p), pages, extra);
  }

  /** A Page's long-form videos. */
  getVideos(account, { pages = 1, ...extra } = {}) {
    return this.#items((p) => this.fb.getPageVideos(account, p), pages, extra);
  }

  /** Top-level comments on a post or reel. */
  getComments(postUrl, { pages = 1, ...extra } = {}) {
    return this.#items((p) => this.fb.getPostComments(postUrl, p), pages, extra);
  }

  /** Public posts matching a keyword. */
  searchPosts(query, { pages = 1, ...extra } = {}) {
    return this.#items((p) => this.fb.searchPosts(query, p), pages, extra);
  }

  /** Pages matching a keyword. */
  searchPages(query, { pages = 1, ...extra } = {}) {
    return this.#items((p) => this.fb.searchPages(query, p), pages, extra);
  }
}
