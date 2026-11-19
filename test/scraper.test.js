import assert from "node:assert/strict";
import { test } from "node:test";
import { main } from "../src/cli.js";
import { FacebookScraperAPI, flatten, itemsOf, recordOf, toCsv } from "../src/index.js";

const POST_A = { post_id: "1", message: "Hello", reactions: { total: 5, like: 4 } };
const POST_B = { post_id: "2", message: 'Say "hi", world', attachments: [{ type: "photo" }] };

const answer = (posts, cursor) => ({
  message: "ok",
  meta: { statusCode: 200, creditsCharged: 1 },
  data: { posts, page_info: { end_cursor: cursor, has_next_page: cursor !== null } },
});

function fakeFetch(answers) {
  const urls = [];
  const fn = async (url, init) => {
    urls.push(new URL(url));
    assert.equal(init.headers["x-api-token"], "test-key");
    return new Response(JSON.stringify(answers[urls.length - 1]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fn, urls };
}

test("getPosts follows the cursor through the real SDK", async () => {
  const f = fakeFetch([answer([POST_A], "c1"), answer([POST_B], null)]);
  const fb = new FacebookScraperAPI({ apiToken: "test-key", fetch: f.fn });
  const posts = [];
  for await (const p of fb.getPosts("nasa", { pages: 5, limit: 9 })) posts.push(p);
  assert.deepEqual(
    posts.map((p) => p.post_id),
    ["1", "2"],
  );
  assert.equal(f.urls.length, 2);
  assert.equal(f.urls[0].pathname, "/facebook/pages/posts");
  assert.equal(f.urls[0].searchParams.get("link"), "https://www.facebook.com/nasa");
  assert.equal(f.urls[0].searchParams.get("limit"), "9");
  assert.equal(f.urls[0].searchParams.has("end_cursor"), false);
  assert.equal(f.urls[1].searchParams.get("end_cursor"), "c1");
});

test("pages is a ceiling", async () => {
  const f = fakeFetch([answer([POST_A], "c1"), answer([POST_B], "c2")]);
  const fb = new FacebookScraperAPI({ apiToken: "test-key", fetch: f.fn });
  for await (const _ of fb.getGroupPosts("123", { pages: 1 })) void _;
  assert.equal(f.urls.length, 1);
  assert.equal(f.urls[0].pathname, "/facebook/groups/posts");
});

test("limit outside 3-9 is refused before any call", () => {
  const f = fakeFetch([]);
  const fb = new FacebookScraperAPI({ apiToken: "test-key", fetch: f.fn });
  assert.throws(() => fb.getPosts("nasa", { limit: 20 }), /3 to 9/);
  assert.equal(f.urls.length, 0);
});

test("itemsOf takes the longest list outside the envelope", () => {
  const body = { meta: { warnings: [{ a: 1 }, { b: 2 }, { c: 3 }] }, data: { items: [POST_A, POST_B], page_info: {} } };
  assert.deepEqual(itemsOf(body), [POST_A, POST_B]);
  assert.deepEqual(itemsOf({ data: [POST_A] }), [POST_A]);
  assert.deepEqual(itemsOf({ data: { posts: [] } }), []);
  assert.deepEqual(recordOf({ message: "ok", meta: {}, 0: { title: "NASA" } }), { title: "NASA" });
});

test("flatten and csv", () => {
  assert.deepEqual(flatten(POST_A), { post_id: "1", message: "Hello", "reactions.total": 5, "reactions.like": 4 });
  const csv = toCsv([POST_A, POST_B]);
  const [header, , second] = csv.trim().split("\r\n");
  assert.equal(header, "post_id,message,reactions.total,reactions.like,attachments");
  assert.match(second, /"Say ""hi"", world"/);
  assert.match(second, /"\[{""type"":""photo""}\]"/);
});

test("missing token is a clear error", () => {
  const saved = process.env.SOCIALAPIS_TOKEN;
  delete process.env.SOCIALAPIS_TOKEN;
  try {
    assert.throws(() => new FacebookScraperAPI(), /SOCIALAPIS_TOKEN/);
  } finally {
    if (saved !== undefined) process.env.SOCIALAPIS_TOKEN = saved;
  }
});

test("cli prints help without a token", async () => {
  let text = "";
  await main(["--help"], { write: (s) => (text += s) });
  assert.match(text, /group-posts/);
});
