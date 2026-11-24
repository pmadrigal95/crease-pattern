---
company: This site
role: Design and development
kind: project
start: 2026-10-01
title: This site, a portfolio you can inspect
summary: A portfolio you can inspect, where every number is measured when it's published.
lede: crease-pattern is this site, with my portfolio and Precrease, the blog where I write about frontend. I design and build it on my own, in public, and what it claims can be checked in its repository.
facts:
  - label: Role
    value: Design and development
  - label: Since
    value: October 2026
  - label: Languages
    value: Spanish and English
  - label: Code
    value: Public, MIT licensed
plates:
  - id: system
    short: Design system
    lead: true
    title: One design system, three identities
    goal: That the site can change its visual identity without changing its components, and that no identity loses contrast.
    approach: I designed a token system in three levels, with primitive colors, semantic tokens and component tokens. The three identities share the same semantic tokens and change only their primitive colors. Each one also has its own origami figure, folded from the same square sheet.
    result: Components are written once for all three identities. A test checks every text and interface color against WCAG 2.2 AA, in each identity, light and dark.
    practice: Design systems
    figure: system
    labels:
      primitives: primitive colors, one set per identity
      idA: Contour lines
      idB: Basalt & glacier
      idC: Washi & asagi
      semantic: Semantic tokens
      same: the same in all three
      components: Components
      contrast: AA contrast tested in every theme
  - id: budgets
    short: Budgets
    title: Every change passes its budgets
    goal: That the site's quality doesn't depend on remembering to check it.
    approach: I wrote the quality bar as data, with weight budgets for the JavaScript and thresholds for performance and accessibility. The tests, continuous integration and the home page's "This site, measured" section read those same values, so what the site says about itself and what it's held to can't drift apart.
    result: A change can't be merged until it passes formatting, types, tests, an accessibility scan in every identity and theme, and the Lighthouse budgets. Then it publishes itself.
    practice: Performance budgets
    figure: gates
    labels:
      change: Change
      tests: tests
      a11y: accessibility
      perf: performance
      weight: weight
      source: one source
      publish: Publishing
      auto: automatic
      blocked: if one fails, it isn't merged
  - id: inspector
    short: Inspector
    title: The page explains how it's built
    goal: That visitors can see how the page they're reading is built, without opening the browser's developer tools.
    approach: I designed the Inspector, which takes the page apart into its layers, shows which component draws each part and reads its real metrics. A manifest generated at build time describes every inspectable part, and the panel downloads only when someone opens it.
    result: The site's pages can be inspected, and visitors who never open the Inspector never download its code.
    practice: Interaction design
    figure: layers
    labels:
      page: Page
      interface: interface
      components: components
      metrics: real metrics
      layers: layers
      onDemand: downloads when opened
  - id: solver
    short: 2022 code
    title: My 2022 code, in the browser
    goal: That the solver I wrote in C in 2022 can run inside an essay, with nothing to install.
    approach: I compiled the original code to WebAssembly with the same algorithm, changing only its input and output. The essay runs it on one thread or several and compares the times on the reader's own device.
    result: Anyone reading the essay on threads can run the 2022 code. If their browser doesn't allow several threads, the essay explains why and runs it on one.
    practice: Software portability
    figure: port
    labels:
      source: 2022 code
      lang: C
      same: same algorithm
      browser: Browser
      serial: one thread
      parallel: several threads
      io: only the input and output change
brief:
  title: What holds it together
  short: Common foundation
  items:
    - title: Accessibility
      text: Every page passes an automated accessibility scan in every identity and theme, and Lighthouse holds it to 100 for accessibility.
    - title: Security
      text: A strict content security policy, so the browser runs only the scripts the site declares.
    - title: Two languages
      text: Every page exists in Spanish and English, and each language has its own search and feed.
---
