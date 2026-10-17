#!/usr/bin/env bash
# Regenerates the three verbatim slices of the reference design system, then
# proves each one with its provenance diff. Run after any edit to
# .agents/skills/framer-plugin-suite/references/design-tokens.css.
#
#   npm run sync:tokens
# Run from the memberframe repo root.
set -euo pipefail

# Every slice is written to a .tmp file and renamed into place. A plain
# "> file" truncates first, and a running Vite dev server can read the file in
# that empty instant and cache an empty stylesheet: every token then vanishes
# from the panel until the file changes again. A rename is atomic.

REF=.agents/skills/framer-plugin-suite/references/design-tokens.css
TODAY=$(date +%Y-%m-%d)

# Section starts are the "/* ----" line right above each numbered heading.
start_of() { echo $(( $(grep -n "^   $1\. " "$REF" | head -1 | cut -d: -f1) - 1 )); }
S3=$(start_of 3)
S5=$(start_of 5)
S6=$(start_of 6)
END=$(wc -l < "$REF")
TOK_END=$((S3 - 1))
BTN_END=$((S5 - 1))
RST_END=$((S6 - 1))
echo "tokens 1-$TOK_END  buttons $S3-$BTN_END  reset $S5-$RST_END  components $S6-$END"

# ---- src/styles/design-tokens.css (16-line header) ----
{
cat <<EOF
/* ==========================================================================
   PROVENANCE: do not hand-edit.

   Verbatim copy of the token layers (sections 1, 2 and 2b) of:
     .agents/skills/framer-plugin-suite/references/design-tokens.css

   Component classes from sections 3 onward of that reference belong in
   src/styles/components.css and the per-component CSS files, not here.
   See PRD section 6.3. This file holds variables only.

   Recopied $TODAY for Foundations v0.4.0 (was v0.3.7),
   reference lines 1 to $TOK_END.
   Check for drift:
     diff <(tail -n +17 src/styles/design-tokens.css) \\
          <(sed -n '1,${TOK_END}p' .agents/skills/framer-plugin-suite/references/design-tokens.css)
   ========================================================================== */
EOF
sed -n "1,${TOK_END}p" "$REF"
} > "src/styles/design-tokens.css.tmp" && mv -f "src/styles/design-tokens.css.tmp" "src/styles/design-tokens.css"

# ---- src/App.css (16-line header) ----
{
cat <<EOF
/* ==========================================================================
   PROVENANCE: do not hand-edit the copied block below.

   Reset and app container only, per PRD section 6.3. Verbatim copy of
   reference section 5 (lines $S5 to $RST_END) of:
     .agents/skills/framer-plugin-suite/references/design-tokens.css

   Variables live in design-tokens.css. Component classes live in
   components.css. Nothing else belongs in this file.

   Recopied $TODAY for Foundations v0.4.0.
   Check for drift:
     diff <(tail -n +17 src/App.css) \\
          <(sed -n '${S5},${RST_END}p' \\
            .agents/skills/framer-plugin-suite/references/design-tokens.css)
   ========================================================================== */
EOF
sed -n "${S5},${RST_END}p" "$REF"
} > "src/App.css.tmp" && mv -f "src/App.css.tmp" "src/App.css"

# ---- src/styles/components.css (20-line header) ----
{
cat <<EOF
/* ==========================================================================
   PROVENANCE: do not hand-edit.

   Verbatim copy of the component layers of:
     .agents/skills/framer-plugin-suite/references/design-tokens.css

   Two slices, concatenated in order:
     reference lines $(printf '%4d' "$S3") to $(printf '%4d' "$BTN_END")   sections 3 and 4, buttons
     reference lines $(printf '%4d' "$S6") to $(printf '%4d' "$END")   sections 6 to 20, every other component

   The gap is deliberate. Reference section 5 (lines $S5 to $RST_END) is the base
   reset and app container, which PRD section 6.3 assigns to src/App.css.
   The variable layers (reference lines 1 to $TOK_END) live in design-tokens.css.

   Recopied $TODAY for Foundations v0.4.0.
   Check for drift:
     diff <(tail -n +21 src/styles/components.css) \\
          <(sed -n '${S3},${BTN_END}p;${S6},${END}p' \\
            .agents/skills/framer-plugin-suite/references/design-tokens.css)
   ========================================================================== */
EOF
sed -n "${S3},${BTN_END}p;${S6},${END}p" "$REF"
} > "src/styles/components.css.tmp" && mv -f "src/styles/components.css.tmp" "src/styles/components.css"

# ---- prove all three ----
diff <(tail -n +17 src/styles/design-tokens.css) <(sed -n "1,${TOK_END}p" "$REF") && echo "design-tokens.css: no drift"
diff <(tail -n +17 src/App.css) <(sed -n "${S5},${RST_END}p" "$REF") && echo "App.css: no drift"
diff <(tail -n +21 src/styles/components.css) <(sed -n "${S3},${BTN_END}p;${S6},${END}p" "$REF") && echo "components.css: no drift"
