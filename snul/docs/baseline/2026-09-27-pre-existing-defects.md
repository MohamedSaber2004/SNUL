# Pre-existing defects found during Design System Phase 1

Found incidentally while wiring up `npm run lint` in Task 3. **None of these were
introduced by the design-system work** — every file listed here is untouched by
commits `2bb8c3b..HEAD`. They are recorded because `npm run lint` was already
failing before this phase, and two of them are functional bugs rather than
style issues.

Reproduce with:

```bash
npm run lint 2>&1 | Select-String '^\S+\.(vue|ts|js):\d+:\d+: error'
```

---

## 1. HIGH — `UserType.Sales` collides with `SnulStaff` and does not exist in the backend

**Files:** `src/domain/models/user.ts:1-7`

```ts
export enum UserType {
  Admin = 1,
  OrganizationUser = 2,
  SnulStaff = 3,
  Sales = 3,        // <-- same value as SnulStaff
  Client = 4,
}
```

The backend enum (`E:\SNUL Site\backend\SNUL\SNUL.Shared\Enums\UserType.cs`) is:

```csharp
public enum UserType
{
    Admin = 1,
    OrganizationUser = 2,
    SnulStaff = 3,
    Client = 4
}
```

There is **no `Sales` member at all**. A search of the entire backend for
`UserType.Sales` returns **0 occurrences**, and the seeder only ever creates
`OrganizationUser` and `SnulStaff` accounts.

### Consequences

1. **A Sales user cannot be persisted.** With no backend enum value, no account
   can be created with a distinct Sales type.
2. **Every SnulStaff user is also "Sales" to the frontend.** Both are `3`, so
   `authService.isSales` is true for every staff user.
3. **`applyRoleTheme()` mislabels staff.** `src/utils/role.ts` evaluates
   `isSales` before `isClient` and after `isProvider`, so a SnulStaff user is
   assigned `data-role="sales"`.
4. **Role gating on `/admin/sales` is unreliable** — it is decided by a value
   that staff already share.

### Why this matters here

The design spec keeps the SNUL-only `Sales` role and `/admin/sales` as a feature
to preserve. That feature has a complete frontend — role, route, admin view, RFQ
and quote flows — resting on an enum value the backend does not have.

### Suggested fix (NOT done here — outside the design-system scope)

Decide the intended numbering, then change it in lockstep:
- pick an unused value for `Sales` in **both** enums (e.g. `5`, since `4` is
  `Client`)
- add a scaffolded EF migration if `UserType` is persisted as an int
- re-check `isSales`, `applyRoleTheme`, and every `RoleAuthorize` attribute
- re-point any seeded Sales account

This needs a decision from the product owner, and it touches a live shared
Azure SQL database, so it is not something to slip into a stylesheet refactor.

---

## 2. MEDIUM — duplicate keys in `DataState.vue` props

**File:** `src/components/ui/DataState.vue:176-177`

```
error vue(no-dupe-keys): Duplicate key 'emptyTitle'
error vue(no-dupe-keys): Duplicate key 'emptyDescription'
```

One of each pair silently wins. `DataState` is the shared empty/loading/error
wrapper used across the app, so whichever declaration is last determines what
every empty state renders. Worth confirming which one is intended.

## 3. MEDIUM — computed properties with no return

**File:** `src/components/ui/GlobalLoader.vue:32` and `:40`

```
error vue(return-in-computed-property): Expected to return a value in computed property
```

A computed getter that can fall off the end returns `undefined`. Consumers get
`undefined` on some branch rather than a value.

## 4. LOW — unused variable

**File:** `src/utils/format.ts:41` — `formatted` is declared and never used.
`formatPrice` is used on every price in the app, so the dead line may indicate
an intended formatting step that was never wired up.

## 5. LOW — unused import in a test

**File:** `src/infrastructure/http/__tests__/refresh.test.ts:1` — `vi` imported
but unused. Harmless, but it suggests a test was partially written.

---

## Not fixed during Phase 1

None of the above were touched. Phase 1 is scoped to design tokens and
tooling; changing a role enum, a shared component's props, or a money-formatting
function mid-refactor would each need their own review and their own
verification. Items 1 and 2 in particular affect behaviour, not appearance.
