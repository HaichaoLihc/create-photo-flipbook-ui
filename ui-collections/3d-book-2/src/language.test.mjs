import assert from "node:assert/strict";
import test from "node:test";
import { configureLanguage, LANGUAGE_STORAGE_KEY, languageRedirect, preferredLanguage } from "./language.js";

const baseUrl = "/create-photo-flipbook-ui/";
const root = `https://example.com${baseUrl}`;
const redirect = (options = {}) => languageRedirect({
  url: root,
  baseUrl,
  currentLanguage: "en",
  languages: ["en-US"],
  ...options,
});

test("chooses the first supported browser language, including Chinese variants", () => {
  for (const locale of ["zh", "zh-CN", "zh-TW", "zh-Hans", "zh-Hant-HK"]) {
    assert.equal(preferredLanguage([locale, "en-US"]), "zh");
    assert.equal(redirect({ languages: [locale] }), `${root}zh/`);
  }
  assert.equal(preferredLanguage(["en-GB", "zh-CN"]), "en");
  assert.equal(preferredLanguage(["ja-JP", "zh-CN", "en"]), "zh");
  assert.equal(preferredLanguage(["fr-FR"]), "en");
  assert.equal(preferredLanguage([]), "en");
});

test("a saved manual choice takes precedence over browser language", () => {
  assert.equal(redirect({ savedLanguage: "en", languages: ["zh-CN"] }), null);
  assert.equal(redirect({ savedLanguage: "zh" }), `${root}zh/`);
  assert.equal(redirect({ savedLanguage: "invalid", languages: ["zh-CN"] }), `${root}zh/`);
});

test("explicit language links override a saved choice and avoid redirect loops", () => {
  assert.equal(redirect({ url: `${root}?lang=en`, savedLanguage: "zh", languages: ["zh-CN"] }), null);
  const target = redirect({ url: `${root}?lang=zh`, savedLanguage: "en" });
  assert.equal(target, `${root}zh/?lang=zh`);
  assert.equal(redirect({ url: target, currentLanguage: "zh", savedLanguage: "en" }), null);
  assert.equal(redirect({ url: `${root}zh/?lang=en`, currentLanguage: "zh" }), `${root}?lang=en`);
});

test("a direct Chinese link stays Chinese even with English preferences", () => {
  assert.equal(redirect({ url: `${root}zh/`, currentLanguage: "zh", savedLanguage: "en" }), null);
});

test("redirects retain query parameters, section anchors, and the hosting subpath", () => {
  assert.equal(redirect({ url: `${root}index.html?utm_source=readme#how-it-works`, languages: ["zh"] }),
    `${root}zh/?utm_source=readme#how-it-works`);
  assert.equal(redirect({ url: "http://localhost:5173/?ref=local#demo", baseUrl: "/", languages: ["zh"] }),
    "http://localhost:5173/zh/?ref=local#demo");
});

function browser({ url = root, language = "en", languages = ["en-US"], saved, blockedStorage = false } = {}) {
  const values = new Map(saved ? [[LANGUAGE_STORAGE_KEY, saved]] : []);
  const links = ["en", "zh"].map((value) => ({
    dataset: { language: value },
    addEventListener(event, handler) { this[event] = handler; },
  }));
  const win = {
    location: { href: url, replace(target) { this.replaced = target; } },
    navigator: { languages, language: languages[0] },
    get localStorage() {
      if (blockedStorage) throw new Error("Storage is disabled");
      return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
    },
  };
  const doc = { documentElement: { lang: language }, querySelectorAll: () => links };
  return { win, doc, links, values };
}

test("manual switching remembers the choice and preserves the current section", () => {
  const context = browser();
  configureLanguage(context.win, context.doc, baseUrl);
  context.win.location.href = `${root}#get-started`;
  context.links[1].click();
  assert.equal(context.links[1].href, `${root}zh/?lang=zh#get-started`);
  assert.equal(context.values.get(LANGUAGE_STORAGE_KEY), "zh");
});

test("language detection and switching work when browser storage is blocked", () => {
  const chinese = browser({ languages: ["zh-CN"], blockedStorage: true });
  configureLanguage(chinese.win, chinese.doc, baseUrl);
  assert.equal(chinese.win.location.replaced, `${root}zh/`);

  const english = browser({ url: `${root}?lang=en`, languages: ["zh-CN"], blockedStorage: true });
  assert.doesNotThrow(() => configureLanguage(english.win, english.doc, baseUrl));
  assert.equal(english.win.location.replaced, undefined);
  assert.doesNotThrow(() => english.links[1].click());
  assert.equal(english.links[1].href, `${root}zh/?lang=zh`);
});

test("an explicit language choice is saved and navigator.language is a fallback", () => {
  const context = browser({ url: `${root}?lang=en`, saved: "zh", languages: ["zh"] });
  configureLanguage(context.win, context.doc, baseUrl);
  assert.equal(context.values.get(LANGUAGE_STORAGE_KEY), "en");
  assert.equal(context.win.location.replaced, undefined);

  const fallback = browser();
  fallback.win.navigator = { language: "zh-CN" };
  configureLanguage(fallback.win, fallback.doc, baseUrl);
  assert.equal(fallback.win.location.replaced, `${root}zh/`);
});
