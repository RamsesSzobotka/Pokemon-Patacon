# Skill Registry — Pokemon-Patacon

Last updated: 2026-05-23

## User-Level Skills (~/.config/opencode/skills/)

| Skill | Path | Trigger |
|-------|------|---------|
| go-testing | `~/.config/opencode/skills/go-testing/SKILL.md` | When writing Go tests, using teatest, or adding test coverage |
| skill-creator | `~/.config/opencode/skills/skill-creator/SKILL.md` | When user asks to create a new skill, add agent instructions, or document patterns for AI |

## SDD Phase Skills (~/.config/opencode/skills/sdd-*/)

| Skill | Path |
|-------|------|
| sdd-init | `~/.config/opencode/skills/sdd-init/SKILL.md` |
| sdd-explore | `~/.config/opencode/skills/sdd-explore/SKILL.md` |
| sdd-propose | `~/.config/opencode/skills/sdd-propose/SKILL.md` |
| sdd-spec | `~/.config/opencode/skills/sdd-spec/SKILL.md` |
| sdd-design | `~/.config/opencode/skills/sdd-design/SKILL.md` |
| sdd-tasks | `~/.config/opencode/skills/sdd-tasks/SKILL.md` |
| sdd-apply | `~/.config/opencode/skills/sdd-apply/SKILL.md` |
| sdd-verify | `~/.config/opencode/skills/sdd-verify/SKILL.md` |
| sdd-archive | `~/.config/opencode/skills/sdd-archive/SKILL.md` |

## Built-In Skills (OpenCode)

| Skill | Trigger |
|-------|---------|
| customize-opencode | When editing/creating opencode's own configuration (opencode.json, files under ~/.config/opencode/) |

## Project-Level Convention Files

| File | Description |
|------|-------------|
| `AGENT.md` | Full PRD (Product Requirements Document) — game design, battle mechanics, architecture, database schema, endpoints, WebSocket protocol, UI/UX specs |
| `README.md` | Project overview, quick start guide, technology stack, known limitations |
| `docs/PRD.md` | Copy/link of the PRD in docs/ |
| `docs/architecture/API_ENDPOINTS.md` | REST API endpoint documentation |
| `docs/architecture/SCHEMAS_MONGODB.md` | MongoDB collection schemas |
| `docs/architecture/WEBSOCKET_PROTOCOL.md` | WebSocket event protocol |
| `docs/Battle/SPEC_BATALLA.md` | Battle spec (V1) |
| `docs/Battle/SPEC_BATALLA_V2.md` | Battle spec (V2) — status effects |
| `docs/Battle/SPEC_BATALLA_V3.md` | Battle spec (V3) — 2-turn moves, fatigue |
| `docs/Battle/SPRITE_SHINY_VALIDATION.md` | Shiny sprite validation rules |
| `docs/skills/SKILL.md` | UI/UX design skill — Ruby GBA-inspired style guide |
| `docs/skills/UI_COLOR_STYLE_GUIDE.md` | CSS color palette, button styles, animations, typography |

## Project Context Notes

- **Monorepo**: `frontend/` + `backend/`
- **Frontend**: React 18 + TypeScript, Vite 6, TanStack Router, TanStack React Query, Clerk auth
- **Backend**: Bun + Hono 4, native MongoDB driver (not Mongoose), WebSocket via Bun.serve
- **DevOps**: Docker Compose (3 services: MongoDB 7, backend, frontend)
- **Testing**: `bun test` (no test files found yet)
- **Linting**: ESLint 8 + Prettier 3 configured in package.json (no config files found in project root)
- **No `.agent/`, `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md` project-level AI convention files exist
