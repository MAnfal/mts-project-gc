# GC AI app UI — observed 2026-11-22 (app.gc.ai, logged-in trial, read-only)

## Tokens (computed, light theme `theme--legacy`)
- Font: Inter (sans, display, serif all = Inter). Body 16px. Headings navy, h1 24/700, h2 20/600.
- Canvas bg `--background` #f4f5f1 (cream) · card/surface #fefeff · muted/secondary #ede2d8 (stone-200) · stone #f1ebe3
- Foreground #061118 (midnight) · heading #173c51 (navy-700) · secondary text #494849
- Primary/accent #173c51 navy, on-primary #f4f5f1 · accent-hover #4398c4 · accent-soft #e4f5fc · ring #7ec5e6
- Border default rgba navy 0.14 (#15394e/0.14), subtle 0.08, strong 0.28; `--border` #c5b4a5, input #dccfc0, row border #e5e5e5
- Status pairs (surface/foreground): red #f5e3df/#8d2e24 · orange #f7e6d7/#8e4a15 · yellow #f5eccb/#7b5a11 · green #e7efe5/#3f6b4a · teal #dfedea/#1f5d53 · blue #e0ebf1/#24516f · purple #eae4f0/#55407d · neutral #f4f3e9
- success #377853 · danger #ab544a · info #3682aa
- Navy scale 900→050: #051924 #03212e #173c51 #314e5e #436271 #5c7d8b #87a7b5 #b8ced9 #dfebee #edf2f6
- Stone scale: 050 #fdf8f6 100 #f4f3e9 200 #ede2d8 300 #dccfc0 400 #c5b4a5 500 #a49483 600 #857869 700 #64584c
- Radius: sm 4 · md 6 (buttons) · lg 12 · xl 16 · base .5rem
- Shadows: navy-tinted, soft (xs 0 1px 2px navy/.06; sm 0 2px 6px/.07 + 0 1px 2px/.05; md 0 8px 24px -8px/.16)

## Layout + components
- 3-pane shell: left sidebar on cream (logo, ⌘K search pill, nav: New chat / Projects / Automations / Contract Intelligence / More, RECENTS small-caps label, footer user + trial badge); center = white rounded panel floating on cream; right panel (Skills | Files segmented tabs, search + "+ New" navy button, filter pills, collapsible small-caps groups with counts, star toggles).
- Buttons: primary navy filled, 34px tall, 6px radius, 14px/500. Secondary: outlined pills/rect with icons (filter pills "All", "Group: Owner").
- Segmented controls (Daily/Weekly/Monthly…), circular day toggles (navy filled = on), info callout on stone bg (#ede2d8-ish) with ⓘ icon.
- Forms: label above, light-bordered inputs, textarea; composer with bottom toolbar (+, company profile select with building icon, project select with folder icon, tag chips "Labels"/"Connectors").
- Page header: title + one-line description left, primary action right; filter pill row; Grid/List toggle.
- Chat answer: "Worked for X ▾" collapsible trace → steps with icons + durations → markdown report; tables with stone/beige header row, rounded border; numbered citation superscripts in soft circles; follow-up suggestion chips (outlined, rounded) above composer.
- Home: centered greeting heading in navy with ↵ glyph, composer, "Ideas for you" list with icon tiles.
- Empty state: centered bold title + one line + navy button.
- Relevant product concepts: **Company profile** (selectable per chat/automation), **Automations** (scheduled chats w/ skills + profile + weekly schedule + email/Slack delivery), Skills library includes "Regulatory Monitor".
