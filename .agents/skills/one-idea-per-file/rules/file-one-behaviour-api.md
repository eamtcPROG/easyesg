---
title: On the API, One Behaviour per File — and a Vocabulary Stays Whole
impact: HIGH
impactDescription: a use case is findable by its file name; a closed set is declared once
tags: file, api, use-case, repository, errors, dto, vocabulary
---

## On the API, One Behaviour per File — and a Vocabulary Stays Whole

**Impact: HIGH (a use case is findable by its file name; a closed set is declared once)**

On `apps/api` the file rule reads *one behaviour per file*: a use case, a service, a controller, a
repository, a consumer — one each, named for what it does. What it does **not** split is a
vocabulary. `<module>.errors.ts` is the module's closed set of refusals and `<name>.dto.ts` is one
wire object with its nested parts; both are declared once and read as one thing. A repository's
private transaction adapter is the same behaviour's second face and stays beside it.

The folder rules (`one-kind-per-folder`) do not apply to the api at all — the module anatomy in
`apps/api/CLAUDE.md` stands (project owner, 11 Sep 2026: *"the api's structure is good"*).

**Incorrect (two use cases in one file):**

```ts
// manage-totp.use-case.ts
export class ManageTotp {
  async execute(command: ManageTotpCommand): Promise<TotpState> { /* enrol, confirm, disable */ }
}

export class ConsumeRecoveryCode {
  async execute(command: ConsumeRecoveryCodeCommand): Promise<void> { /* … */ }
}
```

**Correct (one file per use case):**

```text
use-cases/
├─ manage-totp.use-case.ts             ManageTotp
└─ consume-recovery-code.use-case.ts   ConsumeRecoveryCode
```

**Not a violation (a vocabulary, and a behaviour's second face):**

```ts
// account.errors.ts — nine classes, one closed set: the module's refusals, declared once
export class AccountNotFoundError extends DomainError { … }
export class EmailTakenError extends DomainError { … }
// …

// account-store.repository.ts — the store, and the transaction it hands its use case
export class AccountStoreRepository implements AccountStore { … }
class AccountTransactionAdapter implements AccountTransaction { … }
```

The other tell on the api is a use case whose file holds private helper *classes* beside it: two
resolvers and nine module-level functions around one `execute` is one behaviour's implementation
spread across three ideas, and each resolver is a file — under `domain/` where it is pure.
