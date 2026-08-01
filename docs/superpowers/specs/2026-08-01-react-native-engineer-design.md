# React Native Engineer Design

## Goal

Add a project-local `react-native-engineer` agent for routine React Native and Expo feature delivery in End-Shift, while retaining `native-dev` for senior-level architecture and complex diagnosis.

## Scope

The agent handles components, screens, Expo Router navigation, local UI state, forms, API-client integration, and focused bug fixes in `artifacts/checklist/`. It inspects nearby patterns, makes small typed changes, and runs the checklist typecheck when its edits affect TypeScript.

## Boundaries

The agent must preserve the OpenAPI/code-generation workflow, catalog-managed dependency versions, intentional web token storage, and the React Native-specific behavior in `lib/api-client-react/src/custom-fetch.ts`.

It escalates rather than redesigning when work involves native build configuration, passkeys or authentication, cross-platform divergence, API contracts or database schema changes, or broader architecture decisions.

## Validation

The definition must use valid agent front matter, coexist with `.claude/agents/native-dev.md`, and clearly communicate its scope and escalation boundaries.
