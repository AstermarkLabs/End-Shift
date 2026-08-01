# React Native Engineer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mid-level React Native engineer agent for routine Expo application work.

**Architecture:** Add a standalone project-local Claude agent definition beside the existing senior `native-dev` agent. Encode clear work ownership, project-specific invariants, validation expectations, and escalation boundaries in Markdown front matter and instructions.

**Tech Stack:** Claude project agents, Markdown, Expo, React Native, TypeScript.

## Global Constraints

- Retain `.claude/agents/native-dev.md` as the senior escalation path.
- Do not modify generated API client or schema outputs directly.
- Preserve catalog-managed dependency versions and intentional web token storage.
- Keep unrelated dirty worktree changes untouched.

---

### Task 1: Add and validate the mid-level React Native agent

**Files:**

- Create: `.claude/agents/react-native-engineer.md`
- Test: `.claude/agents/react-native-engineer.md` front matter and content

**Interfaces:**

- Consumes: `.claude/agents/native-dev.md` as the senior-role boundary and `CLAUDE.md` as project guidance.
- Produces: A discoverable `react-native-engineer` agent definition for focused Expo and React Native work.

- [x] **Step 1: Create the agent definition**

Write YAML front matter with the exact agent name and a trigger description, followed by instructions that cover routine Expo work, project invariants, validation, and escalation boundaries.

- [x] **Step 2: Validate agent front matter and scope**

Run:

```bash
node -e 'const fs=require("fs"); const s=fs.readFileSync(".claude/agents/react-native-engineer.md","utf8"); if(!/^---\nname: react-native-engineer\ndescription: .+\n---\n/s.test(s)) throw new Error("invalid front matter"); for(const x of ["typecheck","custom-fetch.ts","native-dev"]) if(!s.includes(x)) throw new Error(`missing ${x}`)'
```

Expected: command exits with status 0.

- [x] **Step 3: Review the focused diff**

Run:

```bash
git add .claude/agents/react-native-engineer.md docs/superpowers/plans/2026-08-01-react-native-engineer.md
git diff --cached --check
git diff --cached --name-status
git diff --cached
```

Expected: no whitespace errors; the staged name-status and diff contain only the agent definition and plan.

- [x] **Step 4: Commit the completed agent work**

Run:

```bash
git commit -m "feat: add react native engineer agent"
```

Expected: a commit containing only the already-staged agent definition and its implementation plan.
