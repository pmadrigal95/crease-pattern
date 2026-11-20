---
company: Buo
role: Lead Frontend Architect
start: 2021-12-01
title: Buo's frontend, from one person to a team
summary: Buo's frontend, from one person to a team.
lede: Buo is an AI people analytics platform for companies in Mexico and Latin America. I joined as its only frontend developer; today I lead the team and the architecture of its web applications.
facts:
  - label: Role
    value: Lead Frontend Architect
  - label: Since
    value: December 2021
  - label: Before
    value: Frontend Lead
  - label: Scope
    value: The product's web applications
plates:
  - id: architecture
    short: Architecture
    lead: true
    title: An architecture for the whole product
    goal: That the product's applications work as one product, and that each one can change on its own.
    approach: I built the technical foundation of the main applications and a set of features they share, and designed how they communicate with each other. Inside each application, I defined a module pattern that separates the interface from the business rules. I also created reusable components, such as advanced filters, dashboards with charts and tables that remember each person's preferences.
    result: The team builds on that foundation and applies the patterns on its own. On new modules, my role is to review their architecture.
    practice: Application architecture
    figure: arch
    labels:
      app: application
      talk: they communicate with each other
      shared: shared foundation
      inside: one application, inside
      ui: interface · reusable components
      rules: business rules
      data: data access
      pattern: module pattern
  - id: publishing
    short: Publishing
    title: Every application publishes itself
    goal: That every application in the product publishes automatically.
    approach: I designed an automatic publishing process for each application and a plan to adopt it in stages, with the option to roll back at each one.
    result: Today every application publishes automatically. I led the rollout together with the infrastructure team and documented how to run the process.
    practice: Continuous delivery
    figure: deploy
    labels:
      change: Change
      app: application
      each: each on its own
      publish: Publishing
      auto: automatic
      pilot: pilot
      oneByOne: one by one
      all: all
      back: roll back at every stage
  - id: review
    short: AI review
    title: A first review in minutes
    goal: That every change gets a quick first review, so the team's review can focus on what matters.
    approach: An AI reviewer comments on every proposed change, following criteria the team itself defines and adjusts.
    result: Every change gets a first review within minutes.
    practice: AI-assisted code review
    figure: review
    labels:
      change: Change
      proposed: proposed
      reviewer: AI reviewer
      first: first review
      criteria: criteria
      team: set by the team
      review: Review
      byTeam: by the team
      minutes: minutes
  - id: decisions
    short: Decisions
    title: Decisions written down and verifiable
    goal: That architecture decisions are written down and can be verified.
    approach: 'Technical leadership proposed documenting every architecture decision, and we adopted it together. I documented the frontend baseline and added automated checks at two levels: what can be checked is enforced, and AI only suggests.'
    result: Each application's architecture is written down next to its code, and every change is checked against it.
    practice: Architecture decision records
    figure: decisions
    labels:
      decisions: Decisions
      written: written down
      change: Change
      rules: Rules
      enforced: enforced
      ai: AI
      suggests: only suggests
      levels: two levels
brief:
  title: The common foundation
  short: Common foundation
  items:
    - title: Modernization
      text: I proposed a frontend modernization plan with evaluated alternatives; technical leadership approved it, and I led its first phase.
    - title: Quality
      text: I standardized tests, release notes and publishing guides across all the applications.
    - title: Security
      text: Security is part of the process for every change.
---
