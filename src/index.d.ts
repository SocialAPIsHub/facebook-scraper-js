import type { Facebook, GroupInfo, PageInfo } from "socialapis-sdk";

export declare const VERSION: string;

/** One record as the API returns it (fields vary by endpoint; extra fields are kept). */
export type FacebookRecord = Record<string, any>;

export interface ListOptions {
  /** How many API calls to make at most (default 1). */
  pages?: number;
  /** Any other query parameter of the endpoint (see socialapis.io/api-sources). */
  [param: string]: unknown;
}

export interface PostListOptions extends ListOptions {
  /** Posts per call, 3-9 (default 3). Cost: round(limit / 3) credits per call. */
  limit?: number;
  /** ISO 8601 timestamp. */
  after?: string;
  /** ISO 8601 timestamp. */
  before?: string;
}

export interface FacebookScraperAPIOptions {
  /** Defaults to process.env.SOCIALAPIS_TOKEN. */
  apiToken?: string;
  fetch?: typeof fetch;
  client?: Facebook;
}

type Listing = AsyncGenerator<FacebookRecord, void, unknown>;

export declare class FacebookScraperAPI {
  constructor(opts?: FacebookScraperAPIOptions);
  getPageInfo(account: string, extra?: Record<string, unknown>): Promise<PageInfo>;
  getGroupInfo(group: string, extra?: Record<string, unknown>): Promise<GroupInfo>;
  getPost(postUrl: string, options?: { extended?: boolean; [param: string]: unknown }): Promise<FacebookRecord>;
  getPosts(account: string, options?: PostListOptions): Listing;
  getGroupPosts(group: string, options?: PostListOptions): Listing;
  getReels(account: string, options?: ListOptions): Listing;
  getVideos(account: string, options?: ListOptions): Listing;
  getComments(postUrl: string, options?: ListOptions): Listing;
  searchPosts(query: string, options?: ListOptions): Listing;
  searchPages(query: string, options?: ListOptions): Listing;
}

export declare function itemsOf(body: unknown): FacebookRecord[];
export declare function recordOf(body: unknown): FacebookRecord;
export declare function flatten(record: FacebookRecord): Record<string, string | number | boolean>;
export declare function toCsv(records: FacebookRecord[]): string;
export declare function nextCursor(body: unknown): string | null;
export declare function paginate<T>(
  fetchPage: (cursor: string | null) => Promise<T>,
  pages: number,
): AsyncGenerator<T, void, unknown>;
