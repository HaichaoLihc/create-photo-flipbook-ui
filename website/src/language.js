export const LANGUAGE_STORAGE_KEY = "photo-flipbook-language";

function supportedLanguage(value) {
  const language = String(value ?? "").toLowerCase().split(/[-_]/)[0];
  return language === "en" || language === "zh" ? language : null;
}

export function preferredLanguage(languages = []) {
  for (const language of languages) {
    const supported = supportedLanguage(language);
    if (supported) return supported;
  }
  return "en";
}

export function languageUrl(language, baseUrl, currentUrl) {
  const current = new URL(currentUrl);
  const target = new URL(language === "zh" ? "zh/" : "./", new URL(baseUrl, current));
  target.search = current.search;
  target.hash = current.hash;
  return target;
}

export function languageRedirect({ url, baseUrl, currentLanguage, savedLanguage, languages }) {
  const current = new URL(url);
  const explicit = current.searchParams.get("lang");
  const validExplicit = explicit === "en" || explicit === "zh" ? explicit : null;
  // A direct link to the Chinese page stays Chinese. Detection is only for the main entry.
  const requested = validExplicit ?? (currentLanguage === "zh" ? "zh" : (
    savedLanguage === "en" || savedLanguage === "zh" ? savedLanguage : preferredLanguage(languages)
  ));
  return requested === currentLanguage ? null : languageUrl(requested, baseUrl, current).href;
}

export function configureLanguage(win, doc, baseUrl) {
  let savedLanguage;
  try {
    savedLanguage = win.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Direct language links keep working when storage is blocked.
  }
  const explicit = new URL(win.location.href).searchParams.get("lang");
  function remember(language) {
    try {
      win.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The link also carries the choice for browsers without storage.
    }
  }
  if (explicit === "en" || explicit === "zh") remember(explicit);

  const redirect = languageRedirect({
    url: win.location.href,
    baseUrl,
    currentLanguage: supportedLanguage(doc.documentElement.lang) ?? "en",
    savedLanguage,
    languages: win.navigator.languages?.length ? win.navigator.languages : [win.navigator.language],
  });
  if (redirect) {
    win.location.replace(redirect);
    return;
  }

  for (const link of doc.querySelectorAll("[data-language]")) {
    const language = link.dataset.language;
    const destination = () => {
      const target = languageUrl(language, baseUrl, win.location.href);
      target.searchParams.set("lang", language);
      return target.href;
    };
    link.href = destination();
    link.addEventListener("click", () => {
      link.href = destination();
      remember(language);
    });
  }
}
