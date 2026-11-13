// Pure cleaner for HTML descriptions imported from Dukaan (and any other source).
//
// String-only: no DOM, no Convex or React imports. It runs in the /sa importer
// (src/lib/storeImport/dukaan.ts), in the one-off migration (convex/migrations.ts)
// and in the check script (scripts/check-clean-description.ts).
//
// Output uses only: p, ul, ol, li, strong, em, h2, h3, a[href], br. That set is a
// subset of the blog allowlist (src/lib/blog/blogRender.ts, sanitizeBlogBody), so
// the blog sanitizer keeps every tag this produces. Running it twice gives the
// same result as running it once.

type Frame = { name: string; html: string; implicit?: boolean; href?: string };

// Tags renamed onto the allowed set (the page has one h1, so source h1s become h2).
const RENAME: Record<string, string> = { b: "strong", i: "em", h1: "h2", h4: "h3", h5: "h3", h6: "h3" };

// Layout-only containers. A break tag ends the current implicit paragraph; its
// text content is kept.
const BREAK_TAGS = new Set([
  "div", "section", "article", "header", "footer", "main", "aside", "nav", "figure", "figcaption",
  "blockquote", "table", "thead", "tbody", "tfoot", "caption", "tr", "td", "th", "dl", "dt", "dd",
  "pre", "address", "center", "form", "fieldset", "details", "summary", "hr", "body", "html",
]);

// Elements whose content is dropped with them.
const DROP_WITH_CONTENT =
  /<(script|style|iframe|noscript|svg|math|template|object|embed|textarea|title|head|video|audio|canvas|select|button)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

const BULLET_START = /^\s*(?:<(?:strong|em)>\s*)?[-•*–·▪●]\s+/;
const BULLET_MARK = /^(\s*(?:<(?:strong|em)>\s*)?)[-•*–·▪●]\s+/;
const BLOCK_EDGE = /\s*(<\/?(?:p|ul|ol|li|h2|h3)>)\s*/g;

function prepare(input: string): string {
  return input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<![^>]*>|<\?[^>]*>/g, "")
    .replace(DROP_WITH_CONTENT, "")
    .replace(/<(script|style)\b[\s\S]*$/i, "") // unclosed: drop to the end
    .replace(/&nbsp;|&#0*160;|&#x0*a0;/gi, " ")
    .replace(/ /g, " ")
    .replace(/&(zwnj|zwj|shy);|&#0*(8203|8204|8205|173|65279);|&#x0*(200b|200c|200d|feff|ad);/gi, "")
    .replace(/[­​-‍⁠﻿]/g, "")
    .replace(/\r\n?/g, "\n");
}

function parseAttrs(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

// http(s), mailto and relative links only. Entity-encoded schemes
// (javascript&#58;) are decoded before the check. Returns the escaped value.
export function safeHref(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\s]/.test(value)) return null;
  const probe = value
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_m, d: string) => String.fromCharCode(Number(d)))
    .replace(/&colon;/gi, ":")
    .replace(/&amp;/gi, "&");
  if (/[\u0000-\u001f\s]/.test(probe)) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(probe);
  if (scheme && !/^(https?|mailto)$/i.test(scheme[1])) return null;
  return value.replace(/"/g, "&quot;").replace(/</g, "%3C").replace(/>/g, "%3E");
}

// Collapse breaks, trim, and drop whitespace around block tags.
function tidy(input: string): string {
  let s = input.replace(/\s*\n\s*/g, " ").replace(/[ \t\f\v]+/g, " ");
  for (let pass = 0; pass < 3; pass++) {
    s = s
      .replace(BLOCK_EDGE, "$1")
      .replace(/(?:<br>\s*){2,}/g, "<br>")
      .replace(/<br>(?=<\/?(?:p|ul|ol|li|h2|h3)>)/g, "")
      .replace(/(<\/(?:p|ul|ol|li|h2|h3)>)<br>/g, "$1")
      .replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, "");
  }
  return s;
}

function block(tag: string, inner: string): string {
  const c = tidy(inner);
  return c ? `<${tag}>${c}</${tag}>` : "";
}

function wrap(tag: string, inner: string, attrs: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
  const lead = m ? m[1] : "";
  const core = m ? m[2] : inner;
  const trail = m ? m[3] : "";
  if (!core.replace(/<br>/g, "").trim()) return /\s/.test(inner) ? " " : "";
  return `${lead}<${tag}${attrs}>${core}</${tag}>${trail}`;
}

// A paragraph body. A line break before a dash or bullet marker starts a list
// item; two or more such lines become a <ul>. Lines around them stay paragraphs.
function paragraphs(raw: string): string {
  const marked = raw.replace(/\n(?=\s*(?:<(?:strong|em)>\s*)?[-•*–·▪●]\s)/g, "<br>");
  const lines = marked.split("<br>");
  const bullets = lines.filter((l) => BULLET_START.test(l)).length;
  if (bullets < 2) return block("p", marked.replace(/\n/g, " "));

  let out = "";
  let plain: string[] = [];
  let items: string[] = [];
  const flushItems = () => {
    const lis = items.map((i) => tidy(i)).filter(Boolean).map((i) => `<li>${i}</li>`);
    if (lis.length) out += `<ul>${lis.join("")}</ul>\n`;
    items = [];
  };
  const flushPlain = () => {
    const p = block("p", plain.join("<br>"));
    if (p) out += p + "\n";
    plain = [];
  };
  for (const line of lines) {
    if (BULLET_START.test(line)) {
      flushPlain();
      items.push(line.replace(BULLET_MARK, "$1"));
    } else {
      flushItems();
      plain.push(line.replace(/\n/g, " "));
    }
  }
  flushItems();
  flushPlain();
  return out;
}

function finish(f: Frame): string {
  switch (f.name) {
    case "p":
      return paragraphs(f.html);
    case "h2":
    case "h3":
      return block(f.name, f.html);
    case "li": {
      const c = tidy(f.html);
      return c ? `<li>${c}</li>` : "";
    }
    case "ul":
    case "ol":
      return f.html.includes("<li>") ? `<${f.name}>${f.html}</${f.name}>` : "";
    case "strong":
    case "em":
      return wrap(f.name, f.html, "");
    case "a":
      return f.href ? wrap("a", f.html, ` href="${f.href}"`) : f.html;
    default:
      return f.html;
  }
}

export function cleanDescription(input: string | null | undefined): string {
  if (!input) return "";
  const src = prepare(String(input));
  const stack: Frame[] = [{ name: "root", html: "" }];
  const top = () => stack[stack.length - 1];

  const closeTop = () => {
    const frame = stack.pop()!;
    const out = finish(frame);
    const parent = top();
    parent.html += parent.name === "root" && out ? out + "\n" : out;
  };
  const closeTo = (index: number) => {
    while (stack.length > index) closeTop();
  };
  const nearest = (names: string[]) => {
    for (let i = stack.length - 1; i >= 0; i--) if (names.includes(stack[i].name)) return i;
    return 0;
  };

  // Loose content needs a block: an implicit paragraph at the root, an implicit
  // list item inside a list. An implicit list that text has left is closed first.
  const ensureBlock = (): void => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i];
      if (f.name === "p" || f.name === "h2" || f.name === "h3" || f.name === "li") return;
      if (f.name === "ul" || f.name === "ol") {
        if (f.implicit) {
          closeTo(i);
          return ensureBlock();
        }
        stack.push({ name: "li", html: "", implicit: true });
        return;
      }
      if (f.name === "root") {
        stack.push({ name: "p", html: "", implicit: true });
        return;
      }
    }
  };

  // Like the HTML parser: a new block closes an open paragraph or heading, and a
  // list gets an implicit item when its parent is a list.
  const openBlock = (name: string) => {
    for (;;) {
      const i = nearest(["p", "h2", "h3", "li", "ul", "ol", "root"]);
      const f = stack[i];
      if (f.name === "p" || f.name === "h2" || f.name === "h3" || (f.implicit && (f.name === "ul" || f.name === "ol"))) {
        closeTo(i);
        continue;
      }
      break;
    }
    if (top().name === "ul" || top().name === "ol") stack.push({ name: "li", html: "", implicit: true });
    stack.push({ name, html: "" });
  };

  const openLi = () => {
    const names = ["li", "ul", "ol", "p", "h2", "h3", "root"];
    let i = nearest(names);
    if (stack[i].name === "li") {
      closeTo(i);
      i = nearest(names);
    }
    const n = stack[i].name;
    if (n !== "ul" && n !== "ol") {
      if (n === "p" || n === "h2" || n === "h3") closeTo(i);
      stack.push({ name: "ul", html: "", implicit: true });
    }
    stack.push({ name: "li", html: "" });
  };

  const breakFlow = () => {
    if (top().implicit) closeTop();
  };

  const openTag = (name: string, attrs: Record<string, string>) => {
    if (name === "br") {
      ensureBlock();
      top().html += "<br>";
      return;
    }
    if (BREAK_TAGS.has(name)) return breakFlow();
    if (name === "p" || name === "h2" || name === "h3" || name === "ul" || name === "ol") return openBlock(name);
    if (name === "li") return openLi();
    if (name === "strong" || name === "em") {
      ensureBlock();
      stack.push({ name, html: "" });
      return;
    }
    if (name === "a") {
      ensureBlock();
      stack.push({ name, html: "", href: safeHref(attrs.href) ?? undefined });
    }
    // img, span, font, unknown tags: dropped, their text is kept.
  };

  const closeTag = (name: string) => {
    if (name === "br" || name === "img") return;
    if (BREAK_TAGS.has(name)) return breakFlow();
    for (let i = stack.length - 1; i > 0; i--) {
      if (stack[i].name === name) {
        closeTo(i);
        return;
      }
    }
  };

  const addText = (text: string) => {
    if (!text) return;
    ensureBlock();
    top().html += text;
  };

  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|(<)|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = token.exec(src))) {
    if (m[5] !== undefined) addText(m[5]);
    else if (m[4] !== undefined) addText("&lt;");
    else if (m[2] !== undefined) {
      const raw = m[2].toLowerCase();
      const name = RENAME[raw] ?? raw;
      if (m[1]) closeTag(name);
      else openTag(name, parseAttrs(m[3] ?? ""));
    }
  }
  while (stack.length > 1) closeTop();
  return stack[0].html.trim();
}
