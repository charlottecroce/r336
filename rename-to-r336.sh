#!/usr/bin/env bash
#
# rename-to-r336.sh — rebrand Spicebag -> R336, .sb -> .r336, sbc -> r336c.
#
# Usage:
#   git checkout -b rename-to-r336      # do this first, on a clean tree
#   ./rename-to-r336.sh                 # apply
#   DRY_RUN=1 ./rename-to-r336.sh       # print what would happen, touch nothing
#
# Run from the repo root. Review `git diff` afterward before committing —
# this touches identifiers and fixture strings, not just prose, so it's
# worth a real look, not just a green test run.

set -euo pipefail

# ── config ──────────────────────────────────────────────────────────────
OLD_EXT="sb"          # extension without the dot
NEW_EXT="r336"
OLD_NAME_TITLE="Spicebag"
NEW_NAME_TITLE="R336"
OLD_NAME_UPPER="SPICEBAG"
NEW_NAME_UPPER="R336"
OLD_NAME_LOWER="spicebag"
NEW_NAME_LOWER="r336"
OLD_BIN="sbc"
NEW_BIN="r336c"
EXCLUDES=(--exclude-dir=.git --exclude-dir=node_modules)

DRY_RUN="${DRY_RUN:-0}"
run() { if [ "$DRY_RUN" = "1" ]; then echo "+ $*"; else "$@"; fi; }

if [ "$DRY_RUN" != "1" ] && [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean. Commit or stash first, or run with DRY_RUN=1." >&2
  exit 1
fi

echo "== inventory (before) =="
echo "  .${OLD_EXT} files:   $(find . -type f -name "*.${OLD_EXT}" -not -path './.git/*' -not -path './node_modules/*' | wc -l)"
echo "  '${OLD_NAME_LOWER}' mentions (any case): $(grep -rliI "${EXCLUDES[@]}" -i "${OLD_NAME_LOWER}" . | wc -l) files"
echo

echo "== 1/6: renaming every .${OLD_EXT} source file to .${NEW_EXT} (git mv, keeps history) =="
while IFS= read -r f; do
  run git mv "$f" "${f%."${OLD_EXT}"}.${NEW_EXT}"
done < <(find . -type f -name "*.${OLD_EXT}" -not -path './.git/*' -not -path './node_modules/*')
echo

echo "== 2/6: renaming the compiler binary itself =="
if [ -f "bin/${OLD_BIN}.js" ]; then
  run git mv "bin/${OLD_BIN}.js" "bin/${NEW_BIN}.js"
fi
echo

echo "== 3/6: IMPORTANT — src/codegen.js hardcodes the OLD extension's length =="
echo "   const conair = (s) => (s.endsWith('.${OLD_EXT}') ? s.slice(0, -3) + '.js' : s);"
echo "   '.${OLD_EXT}' is 3 characters; '.${NEW_EXT}' is $(( ${#NEW_EXT} + 1 )) characters."
echo "   A text-only rename would leave 'slice(0, -3)' in place and silently"
echo "   truncate every emitted require() path. Attempting an automated fix now;"
echo "   VERIFY IT BY HAND AFTERWARD regardless of whether this succeeds — see"
echo "   the checklist printed at the end of this script."
if [ -f src/codegen.js ]; then
  run perl -pi -e "s/s\.endsWith\('\\.${OLD_EXT}'\) \\? s\\.slice\\(0, -3\\) \\+ '\\.js' : s/s.replace(\\/\\\\.${OLD_EXT}\\\$\\/, '.js')/" src/codegen.js
fi
echo

echo "== 4/6: text rename — ${OLD_NAME_TITLE}/${OLD_NAME_UPPER}/${OLD_NAME_LOWER} -> ${NEW_NAME_TITLE}/${NEW_NAME_UPPER}/${NEW_NAME_LOWER} =="
mapfile -t FILES < <(grep -rliI "${EXCLUDES[@]}" -i "${OLD_NAME_LOWER}" . || true)
for f in "${FILES[@]}"; do
  run perl -pi -e "s/${OLD_NAME_TITLE}/${NEW_NAME_TITLE}/g; s/${OLD_NAME_UPPER}/${NEW_NAME_UPPER}/g; s/${OLD_NAME_LOWER}/${NEW_NAME_LOWER}/g" "$f"
done
echo "  (${#FILES[@]} files touched — includes identifiers like isSpicebag -> isR336; review the diff)"
echo

echo "== 5/6: text rename — the '${OLD_BIN}' tool name -> '${NEW_BIN}' everywhere it's mentioned =="
mapfile -t FILES < <(grep -rlI "${EXCLUDES[@]}" "\\b${OLD_BIN}\\b" . || true)
for f in "${FILES[@]}"; do
  run perl -pi -e "s/\\b${OLD_BIN}\\b/${NEW_BIN}/g" "$f"
done
echo "  (${#FILES[@]} files touched)"
echo

echo "== 6/6: text rename — remaining '.${OLD_EXT}' extension mentions -> '.${NEW_EXT}' =="
echo "   (comments, docs, package.json scripts, and the fake in-memory .${OLD_EXT}"
echo "   source strings used as test fixtures — this is a plain text pass, so it"
echo "   updates embedded source-code-as-strings too, which is what you want.)"
mapfile -t FILES < <(grep -rlI "${EXCLUDES[@]}" "\\.${OLD_EXT}\\b" . || true)
for f in "${FILES[@]}"; do
  run perl -pi -e "s/\\.${OLD_EXT}\\b/.${NEW_EXT}/g" "$f"
done
echo "  (${#FILES[@]} files touched)"
echo

cat <<'EOF'
== done — MANUAL CHECKLIST (nothing above catches these) ==

1. src/codegen.js: open it and confirm the `conair` line no longer contains
   `slice(0, -3)`. If the automated fix above didn't match cleanly, replace
   the whole line by hand with:
       const conair = (s) => s.replace(/\.sb$/, '.js');
   then re-run this script's step 4/5/6 patterns over just that file, or
   hand-edit '.sb' -> '.r336' on that one line.
   Also sanity-check for any *other* hardcoded extension-length slicing:
       grep -rn "slice(0, -3)" --include='*.js' .
       grep -rn "slice(0, -2)" --include='*.js' .

2. README.md's "# SB" heading is a bare abbreviation, not "Spicebag" or
   ".sb", so no automated pass touches it. Fix by hand to "# R336" (or
   whatever short form you want). Also check for other bare "SB" mentions:
       grep -rn '\bSB\b' --exclude-dir=.git --exclude-dir=node_modules .

3. Identifiers built from an abbreviated "Sb"/"sb" fragment (not the full
   word "Spicebag") aren't caught either, e.g. `comhaidSb` in src/index.js.
   Cosmetic only — it still works — but check if you want it consistent:
       grep -rn '\bSb\b\|Sb(' --include='*.js' .

4. feidhmchlár/package.json's "name" will mechanically become "r336" too
   (same string as the language name). Decide if the example app should
   keep a distinct name instead, e.g. "r336-example-app".

5. Regenerate lockfiles rather than hand-editing them:
       npm install --package-lock-only
       (cd feidhmchlár && npm install --package-lock-only)

6. Regenerate the checked-in compiled examples with the renamed compiler,
   so the generated banner and any drift is produced by the compiler
   itself rather than trusted to sed:
       node bin/r336c.js examples
       (cd feidhmchlár && node ../bin/r336c.js bealaí.r336)
       git diff --stat examples/ feidhmchlár/

7. Final verification — these should all come back empty:
       grep -rniI --exclude-dir=.git --exclude-dir=node_modules 'spicebag' .
       grep -rniI --exclude-dir=.git --exclude-dir=node_modules '\.sb\b' .
       grep -rn  '\bsbc\b' --exclude-dir=.git --exclude-dir=node_modules .

8. npm test
EOF
