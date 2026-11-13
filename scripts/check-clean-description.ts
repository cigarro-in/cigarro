// Checks for convex/lib/cleanDescription.ts. Run: npx tsx scripts/check-clean-description.ts
// Also checks the output against the blog allowlist sanitizer (sanitizeBlogBody).
import assert from "node:assert/strict";
import { cleanDescription } from "../convex/lib/cleanDescription";
import { sanitizeBlogBody } from "../src/lib/blog/blogRender";

const cases: Array<[string, string, string]> = [
  ["nbsp and empty tags", "<p>&nbsp;</p><p>Hi&nbsp;there​</p><p> </p>", "<p>Hi there</p>"],
  ["inline style, span, font, class", '<p style="color:red" class="x"><span><font face="a">Pure</font></span></p>', "<p>Pure</p>"],
  ["repeated br collapsed", "<p>One<br><br><br>Two</p>", "<p>One<br>Two</p>"],
  ["leading and trailing br dropped", "<p><br>Text<br></p>", "<p>Text</p>"],
  ["h1 and h4 renamed", "<h1>A</h1><h4><span>B </span></h4>", "<h2>A</h2>\n<h3>B</h3>"],
  ["img and scripts dropped", '<p>x<img src="https://a.test/i.png"><script>alert(1)</script></p>', "<p>x</p>"],
  ["unsafe href dropped", '<p><a href="javascript:alert(1)">bad</a> <a href="https://ok.test/">ok</a></p>', '<p>bad <a href="https://ok.test/">ok</a></p>'],
  ["bullets after br become ul", "<p>Pack - 30g<br>- Origin USA<br>- Nice packing</p>", "<p>Pack - 30g</p>\n<ul><li>Origin USA</li><li>Nice packing</li></ul>"],
  ["div wrappers and nested li", "<ul>\n<li>\n<div><h5>Length</h5><p>100mm</p></div>\n</li>\n</ul>", "<ul><li><h3>Length</h3><p>100mm</p></li></ul>"],
  ["stray li becomes ul", "<li>one</li><li>two</li>", "<ul><li>one</li><li>two</li></ul>"],
  ["loose text becomes p", "Hello<br>world", "<p>Hello<br>world</p>"],
  ["keeps strong and em", "<p><b>Bold</b> and <em>it</em></p>", "<p><strong>Bold</strong> and <em>it</em></p>"],
  ["empty input", "", ""],
  ["cdn img keeps src, alt, lazy only", '<p><img src="https://cdn.cigarro.in/asset_images/orgs/smokeshop/x.webp" width="200" class="a" onerror="x()"></p>', '<p><img src="https://cdn.cigarro.in/asset_images/orgs/smokeshop/x.webp" alt="Pack Name" loading="lazy"></p>'],
  ["cdn img keeps its own alt", '<p><img src="https://cdn.cigarro.in/a.webp" alt="Hero"></p>', '<p><img src="https://cdn.cigarro.in/a.webp" alt="Hero" loading="lazy"></p>'],
  ["img from another host dropped", '<p>a<img src="https://evil.test/x.png" alt="x"></p>', "<p>a</p>"],
];

let failed = 0;
for (const [name, input, expected] of cases) {
  const got = cleanDescription(input, { imgAlt: "Pack Name" });
  try {
    assert.equal(got, expected);
  } catch {
    failed++;
    console.error(`FAIL ${name}\n  got:      ${JSON.stringify(got)}\n  expected: ${JSON.stringify(expected)}`);
  }
}

// Idempotent, and every output passes the blog allowlist unchanged.
const samples = [
  "<ul>\n<li><strong>Pack</strong> - 30g</li>\n</ul>\n<p><br>American Spirit is a brand.&nbsp;</p>",
  '<p><br><img src="https://cdn.cigarro.in/asset_images/orgs/smokeshop/a.webp"><br><br>Read <a href="https://cigarcountry.com/x/" target="_blank">this</a></p>',
  "<h4><span>ESSE DOUBLE CHANGE </span></h4>\n<h3>Applemint</h3>\n<p>Changing</p>",
];
const imgPrefix = "https://cdn.cigarro.in/";
{
  const bad = sanitizeBlogBody('<p><img src="https://evil.test/a.png"><img src="https://cdn.cigarro.in/a.webp" alt="x" loading="lazy"></p>', { imgPrefix });
  assert.equal(bad, '<p><img src="https://cdn.cigarro.in/a.webp" alt="x" loading="lazy"></p>');
}
for (const s of samples) {
  const once = cleanDescription(s, { imgAlt: "Pack Name" });
  assert.equal(cleanDescription(once, { imgAlt: "Pack Name" }), once, `not idempotent: ${once}`);
  // The blog sanitizer adds rel="noopener nofollow" to external links; ignore that one attribute.
  const sanitized = sanitizeBlogBody(once, { imgPrefix }).replace(/ rel="noopener nofollow"/g, "");
  assert.equal(sanitized, once, `sanitizer changed output: ${once}`);
  const tags = new Set([...once.matchAll(/<\/?([a-z0-9]+)/gi)].map((x) => x[1].toLowerCase()));
  for (const t of tags) assert.ok(["p", "ul", "ol", "li", "strong", "em", "h2", "h3", "a", "br", "img"].includes(t), `tag ${t}`);
}

if (failed) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log(`clean-description: ${cases.length} cases and ${samples.length} round-trip samples passed`);
