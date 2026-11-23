# GitHub Pages — පියවරෙන් පියවර

මේක **එක වතාවක්** කරන්න ඕන දෙයක්. ඊට පස්සේ හැම වෙනසක්ම auto-deploy වෙනවා —
build minutes 0, quota 0, නොමිලේ.

සයිට් එකේ හැම දෙයක්ම දැන් සූදානම්: `docs/index.html` (2.5 MB, තනි ෆයිල් එකක්) සහ
`docs/.nojekyll` — branch එකට push කරලා තියෙනවා. Pages site එක තවම හදලා නෑ.

---

## පියවර 1 — Pages on කරන්න

මේ link එක open කරන්න:

**<https://github.com/architecturezen8-cpu/school-store/settings/pages>**

එතන:

| Setting | දාන්න ඕන අගය |
|---|---|
| **Source** | `Deploy from a branch` |
| **Branch** | `arena/e2057950-school-store` |
| **Folder** | `/docs` |
| **Save** | ඔබන්න |

> **ඇයි මේ branch එක?** අලුත්ම කේතය තියෙන්නේ එතන. `main` එකට merge කළාට පස්සේ
> branch එක `main` කර වෙනස් කරන්න පුළුවන් (පියවර 3 බලන්න).

## පියවර 2 — බලන්න (1–2 මිනිත්තුව)

```
https://architecturezen8-cpu.github.io/school-store/
```

Pages tab එකේ "Your site is live at …" කියලා පෙනෙයි. මුල් වතාවේ HTTP 404 එකක්
පෙනුනොත් තව මිනිත්තුවක් ඉන්න — deploy එක තවම යන ගමන්.

## පියවර 3 (optional) — `main` එකට merge කරන්න

Pull request එකක් හදලා `arena/e2057950-school-store` → `main` merge කරන්න:

**<https://github.com/architecturezen8-cpu/school-store/compare/main...arena/e2057950-school-store>**

ඊට පස්සේ Pages setting එකේ branch එක `main` කරන්න. දෙකම වැඩ කරනවා — වෙනස එකම
එක: `main` එකට merge කළොත් අනාගතයේ වෙන branch එකකින් වැඩ කළත් site එක
`main` එකෙන් යනවා.

---

## ඊට පස්සේ වෙනස්කම් කොහොමද යන්නේ

```bash
npm run build:docs        # කේතය → docs/index.html
git add docs/index.html
git commit -m "…"
git push
```

Push එකට පස්සේ හැම වතාවකම GitHub කෙලින්ම `docs/` ෆෝල්ඩරය serve කරන නිසා
**විනාඩියක් ඇතුළත අලුත් අනුවාදය live**. build step එකක් නෑ → build minutes නෑ,
quota නෑ, deploy limit නෑ.

## ගැටළු

**404 පෙන්නනවා**
- Settings → Pages එකේ "Source" එක `Deploy from a branch` ද, folder එක `/docs` ද බලන්න
- `docs/index.html` ඒ branch එකේ තියෙනවද බලන්න: <https://github.com/architecturezen8-cpu/school-store/tree/arena/e2057950-school-store/docs>
- Actions tab එකේ "pages build and deployment" run එක හරි ගියාද බලන්න

**පැරණි අනුවාදයක් පෙන්නනවා**
- Browser cache — `Ctrl+Shift+R` (හෝ incognito)
- `docs/index.html` අලුත්ම commit එකේ තියෙනවද බලන්න

**Pages setting එක record වෙන්නේ නෑ**
- Repo එකේ admin permission තියෙන account එකකින් කරන්න ඕන (`architecturezen8-cpu`)

**`/docs` වෙනුවට root එකෙන් serve කරන්න ඕන**
- Folder එක `/ (root)` දාන්නත් පුළුවන්, ඒත් එතකොට `index.html` root එකට copy කරන්න
  වෙනවා. `/docs` එක තමයි පිරිසිදු ක්‍රමය.

---

## මේක මම automate කරන්න බැරි ඇයි

Arena එකේ GitHub token එකට `pages` scope එක නෑ. API එකෙන් හැදුවොත්:

```
POST /repos/architecturezen8-cpu/school-store/pages
403 Resource not accessible by integration
```

ඒ නිසා ඒ toggle එක browser එකෙන් ඔයා ඔබන්න ඕන. ඔබලා ඉවර වුණාම මට කියන්න —
මම link එක check කරලා, හරිද කියලා බලලා දෙන්නම්.
