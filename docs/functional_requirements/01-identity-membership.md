# Functional requirements — Part 1: Identity, membership and users

Part 1 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.1 Identity and authentication | FR-1 … FR-8, FR-208, FR-209 |
| 3.2 Profile and membership | FR-9 … FR-12 |
| 3.12 Users and access | FR-56 … FR-60 |

Business rules held here: BR-ID-1 … BR-ID-5, BR-ACC-2 … BR-ACC-4 (§4). Entities held here: §5.

**Who may do what in this part.** Every route in §1 and §2 is the account's own. An authenticated user acts on their own account, credentials, profile and memberships whatever role they hold, because Common Access is a set of capabilities every authenticated user holds and not a role (`actors.md` §2 and §3; `architecture.md` §6.5). The routes that make a session exist — registration, verification, reset, sign-in, refresh, sign-out, the social routes and the invitation preview — are open to a caller with no session. Every other route is closed by default (`architecture.md` §6.2). Every route in §3 is for the **Organization Administrator alone** (`actors.md` §5): an editor or a view-only member is refused with 403 `insufficient-role`, and a caller holding no active membership with 403 `membership-required`. No token, or a token this API did not issue, is 401 `authentication-required`; a token whose session is over is 401 `session-expired` (`architecture.md` §6.2). The blocks below say *any authenticated user* or *OA alone* for these rules rather than restating them. The role vocabulary is editor, view-only and Organization Administrator — stored as `editor`, `viewer` and `organization_administrator`, one per membership per organization (`architecture.md` §6.5).

**Tokens.** The verification, password-reset and invitation links share one mechanism (`architecture.md` §12.5.6's token and lifetimes rows): at least 256 bits from a CSPRNG, stored as a SHA-256 digest, compared in constant time and single-use. Lifetimes: email verification 24 h · password reset 60 min · invitation 7 days · account-setup grant 15 min. The verification and reset tokens are posted in a request body rather than followed as a link, so a mail scanner that opens the URL cannot consume them. Each is delivered by email through the outbox, in a transactional category the recipient cannot switch off (`architecture.md` OQ-54; FR-163).

## 1. Identity and authentication (index §3.1)

### FR-1 — Registration with email and password

**Status.** Partial — delivered 19, 20, 21, 26.2, 112, 139, 153 · remaining 185 (a name part with no visible character), 71.1 (the edge's budget, AC-8)

**Obligation.** The system shall allow an account to be registered from an email address and a password, creating an unverified account record and issuing a verification challenge, and shall make no application data reachable until verification completes. A registration presenting a live organization invitation for that same address creates an already-verified account and issues no challenge.

| | |
|---|---|
| **Actors** | A prospective user, a Visitor (VI) until the account exists and a CA after (`actors.md` §3). An invitee arriving from S-03 is the same actor. |
| **Traces** | UC-01 · D-1 · D-6 · BR-ID-1 · `architecture.md` OQ-51, OQ-52, OQ-53, OQ-54, OQ-55, OQ-57 and §12.5.6's task-26.2 row · UX-108 · NFR-64 · entity *Account* |
| **Surfaces** | S-01 (the register step) · S-02 (verification) · S-03's hand-off to S-01 · `POST /auth/register` (201 · 400 · 409) |

**Preconditions.** None. No organization exists yet (UC-01).

**Inputs.** An email address (case is preserved as supplied; uniqueness is case-insensitive). A password. A given name and a family name, both required (FR-9, UX-137, task 139). Each part is trimmed, and a part with no visible character counts as missing, as at setup and on S-27 (§12.5.6 task-182 identity and organization row, 182/6). Optionally a live invitation token for that same address (task 26.2).

**Behaviour.**
1. The account is created `unverified` and a verification email is queued in the same transaction. Sending inside the request is the dual write the outbox exists to remove (OQ-54; `architecture.md` AD-6). Registration issues no session.
2. The password is stored as an Argon2id hash with a per-user salt and a pepper from the secret manager (`architecture.md` §9.1).
3. The password policy is at least 8 and at most 128 characters, with a lowercase letter, an uppercase letter, a digit and one further character. The ceiling is a cost bound on a deliberately expensive hash, not a rule about secrets. There is no breached-password corpus check at MVP (OQ-51).
4. An address that already holds an account is refused with a truthful 409 and not a uniform answer: NFR-64's uniform-response clause is scoped by its own citations to FR-4, FR-6 and FR-11 (OQ-53).
5. No application data is reachable while unverified because sign-in refuses the account. A correct password on an unverified account answers 403 `email-unverified`; a wrong password stays inside the uniform 401 and still counts toward the lockout (OQ-57; FR-4).
6. With an invitation token, the token is validated exactly as acceptance validates it. A live one for the same address creates the account already verified, with no email. A spent, revoked, lapsed or differently-addressed token verifies nothing, and registration proceeds as an ordinary unverified one (task-26.2 row).
7. The founder of a new organization becomes its Organization Administrator when the account proceeds to organization creation (D-1, UC-49; FR-13).

**Refusals.**
- Password outside the policy, a malformed address, or a missing name → 400 `validation-failed` (`identity.registration.password_policy` for the policy)
- Address already registered → 409 `conflict` (`identity.registration.email_taken`)

**Effects.** An `unverified` account row and one outbox event for the verification email. A provider sign-up seeds the name parts from the assertion; a password registration collects them (task 139).

**Configuration-held values.** None for the policy: it is code. The email's category is `identity.email_verification`, channel email, classification transactional (`notification-category.identity.email_verification.json`).

**Boundaries.** Verifying the address is FR-3. Registration through a provider is FR-2. Signing in is FR-4. The edge's 60 requests per minute per IP is the only bound on this route's enumeration oracle, which OQ-53 accepted at that cost; it is task 71.1's and does not exist yet.

**Acceptance criteria.**
- **AC-1** Given an unregistered address, a policy-conforming password and both name parts, when the account is registered, then the answer is 201, the account is unverified, one verification email is queued and no session is issued. *(source: FR text; UC-01; OQ-54)*
- **AC-2** Given an unverified account, when its owner signs in with the correct password, then the answer is 403 `email-unverified` and no application data is reachable. A wrong password answers the uniform 401. *(source: FR text; OQ-57)*
- **AC-3** Given a password of seven characters, or one with no digit, no uppercase letter, no lowercase letter or no further character, then registration is refused with 400 and no account is created. *(source: OQ-51)*
- **AC-4** Given an address already registered, in any letter case, then registration is refused with 409. *(source: OQ-53)*
- **AC-5** Given a live invitation token for the registering address, then the account is created already verified and no verification email is queued. *(source: §12.5.6 task-26.2 row)*
- **AC-6** Given a spent, revoked, lapsed or other-address invitation token, then registration proceeds as an ordinary unverified one. *(source: §12.5.6 task-26.2 row)*
- **AC-7** Given a missing given name or family name, then registration is refused with 400. *(source: FR-9; UX-137; §12.5.6 task-139 row)*
- **AC-8** Given more than 60 requests in a minute from one IP, then the edge answers 429. *(source: §12.5.6 limits table; OQ-53)* Unmet until 71.1.
- **AC-9** Given a given name or family name with no visible character, then registration is refused with 400 `validation-failed` and no account is created. *(source: §12.5.6 task-182 identity and organization row, 182/6; FR-9)* Unmet until 185.

**History.**
- 20 Aug 2026 · platform owner · the password policy, and a registration naming a registered address answers 409 · `architecture.md` OQ-51, OQ-53
- 25 Aug 2026 · project owner · a registration holding a live invitation for that address is already verified · §12.5.6 task-26.2 row; FR-3
- 12 Sep 2026 · project owner · registration collects the given and family name · §12.5.6 task-139 row; UX-137; FR-9
- 5 Oct 2026 · project owner · registration trims each name part and refuses one with no visible character, as setup and S-27 do · §12.5.6 task-182 identity and organization row (182/6)

### FR-2 — Registration through a social identity provider

**Status.** Built — delivered 24, 67.11, 112, 155, 171

**Obligation.** The system shall allow an account to be registered through a social identity provider — Google and Microsoft at MVP — requesting only identifier, email and display name scopes, and shall produce the same account record with the provider identity as its credential. It shall hold the account in a setup state, able to do nothing but complete its setup, until its owner has set a password and supplied a given name and a family name and confirmed the interface language. An account abandoned in setup is deleted seven days after registration, except one moved into setup from active, which may hold organizations and is never deleted by that rule.

| | |
|---|---|
| **Actors** | CA. The invitee who registers through a provider from S-03 is the same actor and completes setup before returning to the invitation. |
| **Traces** | UC-02, UC-05 · D-6 · BR-ID-1, BR-ID-3 · FR-82 · `architecture.md` §12.5.6's task-24, task-67.11, task-155 and task-171 rows, OQ-52 · NFR-69 · entities *Account*, *Provider identity* |
| **Surfaces** | S-01 (provider choices) · S-36 (complete your account) · S-02 (first password by link) · S-03 · web routes `/auth/social/{provider}/start` and `/callback` · `GET /auth/social/providers` · `POST /auth/social/{provider}/challenge` (200 · 400 · 403) · `POST /auth/social/{provider}/session` (201 · 401 · 403 · 404 · 409 · 429) · `GET /account/setup` · `POST /account/setup/password` · `POST /account/setup/profile` · `POST /auth/account-setup/password` |

**Preconditions.** The provider is registered and enabled (FR-82; UC-70).

**Inputs.** The provider's assertion: subject identifier, email address, whether the provider asserts the address verified, and a single display name. The flow's intent — sign in, register or link — travels with the sealed transaction (task-24 row).

**Behaviour.**
1. The OAuth redirect endpoints live on `apps/web`, because only the web tier writes the session cookie. The api is the back channel: `challenge` builds the authorization URL (state, nonce and PKCE are generated api-side) and `session` redeems the code and validates the ID token. The callback's `iss` travels with the code, because a provider that declares RFC 9207 support is refused without it (task-24 row as amended by task 171).
2. The requested scopes are `openid`, `email` and `profile`, held as configuration and shown fixed on A-18. A fourth scope is not requested (FR-2; task-67.11 row (1)).
3. Registration creates an account holding the provider identity and no password. It is `awaiting_setup` at once where the provider asserts the address verified. Otherwise it is `unverified` until its confirmation link is followed, then `awaiting_setup` (FR-3; task-155 row (1)).
4. The name parts are seeded from the assertion's single display name where empty and are never overwritten. No heuristic splits it; S-36 asks for both parts, the given name pre-filled (task-139 row; `design_spec.md` S-36).
5. While in setup the api refuses every route except the setup routes, sign-out and refresh with 403 `account-setup-required`. A setup past its deadline is refused as no account (task-155 row (1), (3)).
6. The account becomes `active` only when it holds a password and both name parts, whichever route supplied them. The first password needs recent proof, since there is no current password to ask for: a session created by a provider sign-in within the last 15 minutes, or a confirmation-link grant consumed within the last 15 minutes. Proof that has lapsed is 403 `account-setup-proof-stale` (task-155 row (2), (4)).
7. The link path's grant is a password-reset token with purpose `account_setup` and a 15-minute life. Each route claims only its own purpose; consuming a grant revokes every session the account already held before issuing its own. That step asks whether to keep the person signed in on this device (task-155 row (4)).
8. An account abandoned in setup is deleted seven days after registration, evaluated at the point of use: sign-in, refresh, reset and registration treat it as no account. The deadline is carried on the account row, and an account moved into setup from active carries none (OQ-52; task-155 row (3)).
9. An identity that authenticates but is linked to no account is offered registration and creates nothing; a register-intent completion against a registered address refuses without creating a duplicate (UC-05 alternate flow; BR-ID-3; task-24 row).
10. An invitee who registers through a provider completes both setup steps, then returns to the invitation (UC-15; task-155 row (5)).

**Refusals.**
- Provider not registered or disabled → 403 `social-provider-unavailable`
- The provider or its ID token refuses the exchange, in any way → 401 `social-exchange-failed`
- Identity linked to no account, on a sign-in intent → 404 `social-identity-unknown`
- Asserted address already holds an account → 409 `social-email-in-use` (BR-ID-3)
- Redirect address outside the provider's allowlist → 400 `social-redirect-rejected`
- Address awaiting verification → 403 `email-unverified`
- Too many attempts → 429 `rate-limited`, keyed on (IP, provider) because the account is unknowable before the exchange (task-24 build-log entry)
- Any route but a setup route, for an account in setup → 403 `account-setup-required`
- First password without recent proof → 403 `account-setup-proof-stale`
- Setup already complete, or a first password already set → 409 `conflict`
- Password outside the policy, or a name or the language missing → 400 `validation-failed`

**Effects.** A `provider_identity` row for the pair (provider, subject), at most one account per pair. Setup saves the names and the interface language through a setup-only call, distinct from S-27's profile update (task-155 row (6)).

**Configuration-held values.** `identity-provider.google.json` and `identity-provider.microsoft.json`: `enabled`, `clientId`, `issuer`, `scopes` (`openid`, `email`, `profile`) and `redirectUris`. The client secret is not configuration: it is the environment value `AUTH_SOCIAL_<PROVIDER>_CLIENT_SECRET` on the HTTP tier, until OpenBao exists (task 154; task-24 row).

**Boundaries.** Enabling, disabling and configuring a provider is FR-82. Matching an existing provider identity at sign-in is FR-4. Attaching a provider to an existing account is FR-8. Giving a passwordless account its first password by reset link is FR-6.

**Acceptance criteria.**
- **AC-1** Given a provider that asserts the address verified and an unregistered address, when the account is registered, then it holds the provider identity, no password and status `awaiting_setup`, and a session issued reaches the setup routes and nothing else. *(source: FR text; §12.5.6 task-155 row (1))*
- **AC-2** Given an account in setup, when it requests any route other than the setup routes, sign-out or refresh, then the answer is 403 `account-setup-required`. *(source: §12.5.6 task-155 row (1))*
- **AC-3** Given an account in setup with a password and no names, then it stays in setup; once both names and the language are saved it becomes active. *(source: §12.5.6 task-155 row (2))*
- **AC-4** Given a provider session older than 15 minutes, when the first password is set, then it is refused with 403 and the person signs in at the provider again. *(source: §12.5.6 task-155 row (4))*
- **AC-5** Given an account abandoned in setup for seven days, then it is treated as no account, and its address can be registered again. *(source: FR text; OQ-52)*
- **AC-6** Given an account moved into setup from active, then no deadline applies and the account is never deleted by that rule. *(source: FR text; §12.5.6 task-155 row (3))*
- **AC-7** Given the identity authenticates and is linked to no account, on sign-in, then 404 is answered and nothing is created. *(source: UC-05 alternate flow)*
- **AC-8** Given a registration for an address that already holds an account, then 409 is answered and no duplicate is created. *(source: BR-ID-3; UC-02 alternate flow)*
- **AC-9** Given a provider that is disabled, then a new registration through it is refused with 403, and existing accounts keep their other credentials. *(source: BR-ID-6; FR-82; `architecture.md` §9.1)*
- **AC-10** Given an invitee registering through a provider, then after both setup steps they return to the invitation. *(source: §12.5.6 task-155 row (5); UC-15)*
- **AC-11** Given a provider callback carrying `iss`, then the exchange accepts it, and a callback with a dropped or foreign issuer is refused. *(source: §12.5.6 task-24 row as amended 25 Sep 2026)*

**History.**
- 24 Aug 2026 · project owner · the redirect endpoints live on `apps/web`; provider behaviour is configuration, the secret stays in the environment · §12.5.6 task-24 rows
- 14 Sep 2026 · project owner · an account is held in setup until it has a password and a name; an abandoned one is deleted after seven days · §12.5.6 task-155 row; D-6 and UC-02 amended
- 14 Sep 2026 · project owner · the requested scopes are shown fixed on A-18 · §12.5.6 task-67.11 row (1)
- 25 Sep 2026 · project owner · the callback's `iss` travels with the code · §12.5.6 task-24 row, task 171

### FR-3 — Verify the email address

**Status.** Partial — delivered 19, 20, 26.2, 155 · remaining 200 (the scheduled sweep that reclaims expired rows)

**Obligation.** The system shall verify control of a registered email address through a time-limited link, transitioning the account to active; shall expire unverified accounts after a defined window; and shall treat verification as satisfied where a provider asserts an already-verified address, or where the account is registered from a live organization invitation issued to that same address. For an account registered through a provider, a verified address satisfies verification but does not make the account active: it enters the setup state until its password and names are set (FR-2), and confirming by link opens its password step for 15 minutes.

| | |
|---|---|
| **Actors** | CA. SYS reclaims the expired rows. |
| **Traces** | UC-03 · BR-ID-1 · `architecture.md` OQ-52, OQ-54, OQ-55, OQ-57 · NFR-64 · FR-1, FR-2 · entity *Account* |
| **Surfaces** | S-02 (confirm the address; request a new link) · `POST /auth/verify-email` (200 · 400) · `POST /auth/verification-email` (202 · 400) · S-36 |

**Preconditions.** An unverified account exists (FR-1), or a provider has asserted the address (FR-2).

**Behaviour.**
1. The link lasts 24 hours and is single-use. The token is posted in the body of `POST /auth/verify-email` (§12.5.6 token row; the route's OpenAPI description).
2. Following a valid link moves the account from unverified to active. For an account holding no password — registered through a provider that did not assert the address — it moves to setup instead, and the answer carries a single-use grant that sets the first password within 15 minutes (task-155 row (4)).
3. The account's own window is **7 days from registration**, a different object from the link's 24 hours. After it the record is deleted and the address is registrable again. It is enforced at the point of use: an account past the window can neither be verified nor block a new registration (OQ-52).
4. A user whose link has lapsed asks for another through `POST /auth/verification-email`. The answer is identical whether the address is unknown, already verified or unverified and reissued, and a new link invalidates any outstanding one, so exactly one challenge is live (OQ-55).
5. Where a provider asserts the address verified, or a live invitation for that address is presented at registration, no verification email is sent (FR-1; FR-2).

**Refusals.**
- A link never issued, already used, lapsed, or belonging to an account that has itself expired → 400 `verification-token-invalid` (`identity.verification.token_invalid`). The four are deliberately indistinguishable.
- A malformed address on the resend → 400 `validation-failed`. It states nothing about whether an account exists.

**Effects.** The account's status changes to `active`, or to `awaiting_setup` with its grant. A reissue replaces the outstanding token.

**Configuration-held values.** The email's category is `identity.email_verification` (`notification-category.identity.email_verification.json`: channel email, transactional). The 24 hours and 7 days are §12.5.6 values.

**Boundaries.** Registering is FR-1; the setup state is FR-2. The resend route is an auth path for rate limiting, and the edge's share of that is task 71.1 (OQ-55). Reclaiming expired rows is data hygiene that OQ-52 placed with the scheduler; 200 owns it (§12.5.6 task-182 tracking row, 182/158).

**Acceptance criteria.**
- **AC-1** Given a valid unexpired link, when it is followed, then the account is active. For a passwordless provider account it is in setup, with a 15-minute grant in the answer. *(source: FR text; UC-03; §12.5.6 task-155 row (4))*
- **AC-2** Given a link that was never issued, was already used, has lapsed, or belongs to an expired account, then the answer is 400 `verification-token-invalid` in all four cases. *(source: FR text; OQ-52; the route's OpenAPI description)*
- **AC-3** Given an account unverified for more than 7 days, then it cannot be verified and does not block registering the same address again. *(source: FR text; OQ-52)*
- **AC-4** Given a request for a new link, then the answer is identical for an unknown, an already verified and an unverified address, and the previous link no longer works. *(source: OQ-55)*
- **AC-5** Given a provider that asserts the address verified, then no verification email is sent. *(source: FR text; UC-02 step 4)*
- **AC-6** Given a registration from a live invitation for the same address, then no verification email is sent. *(source: FR text; §12.5.6 task-26.2 row)*
- **AC-7** Given the rows of accounts past the window, then a scheduled sweep deletes them. *(source: OQ-52)* Unmet until 200.

**History.**
- 20 Aug 2026 · platform owner · the defined window is 7 days and the record is deleted; a second link is obtainable without a new account · `architecture.md` OQ-52, OQ-55
- 25 Aug 2026 · project owner · a live invitation for the same address satisfies verification · §12.5.6 task-26.2 row
- 14 Sep 2026 · project owner · for a passwordless provider account, verification enters setup and the confirming link opens a 15-minute password step · §12.5.6 task-155 row; UC-03 amended
- 5 Oct 2026 · project owner · the scheduled sweep that deletes the rows of accounts past the window is its own task in the operations stage · §12.5.6 task-182 tracking row (182/158)

### FR-4 — Authenticate, with a lockout

**Status.** Built — delivered 21, 22, 24, 25.4, 27.3, 27.8, 97, 112, 155, 171

**Obligation.** The system shall authenticate by whichever credential the account holds and issue a session scoped to the user's organization memberships and roles, shall match a provider identity on its subject identifier rather than its email address, and shall rate-limit failed attempts and lock out after a threshold.

| | |
|---|---|
| **Actors** | CA. |
| **Traces** | UC-04, UC-05 · UC-194 for the second-factor step (FR-208) · UC-214 for the Platform Administrator's release (FR-209) · BR-ID-1, BR-ID-2 · `architecture.md` AD-12, OQ-19, OQ-33, OQ-35, OQ-57 and §12.5.6's task-21, task-27.3, task-97, task-141 rows · NFR-64, NFR-95 · UX-108, UX-136 · entities *Session*, *Provider identity* |
| **Surfaces** | S-01 (password and provider sign-in; the second-factor step at `/sign-in/factor`) · §4.3's post-sign-in branch · `POST /auth/session` (201 · 401 · 403 · 429) · `POST /auth/session/factor` (201 · 403 · 429) · `POST /auth/session/refresh` (200 · 401) · `POST /auth/social/{provider}/session` (FR-2) |

**Preconditions.** The account is active and holds the credential presented (UC-04, UC-05).

**Inputs.** An email and a password, with the choice to be kept signed in on this device; or a provider's authorization code (FR-2).

**Behaviour.**
1. `POST /auth/session` answers 201 with one of two shapes, discriminated by `kind`: `signed_in`, carrying the session, for an account with no second factor; or a `challenge` for one that has it. An account with no factor is never challenged (task-27.3 rows; UC-194).
2. The credential refusal is one answer. An unknown address, a wrong password, and a wrong password on an unverified account are all 401 `credential-invalid` (NFR-64). A correct password on an unverified account is the distinct 403 `email-unverified` (OQ-57).
3. A session is a short-lived access token (15 minutes at most) carrying `session_id` and nothing else of authorization consequence, with an opaque refresh token that rotates on use. Role and active organization are read from the membership record on every request (AD-12; FR-58).
4. A password session and a provider session are identical in scope. They are identical in lifetime wherever the person asked to be remembered: remembered is 7 days idle and 30 days absolute; not remembered is 12 hours idle and 12 hours absolute. A provider session is always the remembered pair, because the provider buttons are plain anchors that carry no client JavaScript (OQ-35). The choice also rides the sealed factor challenge, so a client cannot drop it (task-97 row), and it is offered on S-36's password step on S-02's path (task-155 row (4)).
5. A provider identity is matched on (provider, subject identifier) and never on its email. A provider-asserted address that has drifted from the account's is recorded and not resolved, and the same account is found (UC-05; §9.1).
6. Every sign-in attempt counts toward a window of 5 attempts per 15 minutes per (IP, account), the attempt being admitted before the password is verified. The 6th is 429 `rate-limited`, uniform whether or not the address holds an account (§12.5.6 limits table; task-141 row).
7. 10 consecutive failures lock the account: 403 `account-locked`, a durable state and not a pressure valve. The lock is released by consuming a password-reset link (FR-6). A Platform Administrator may also release it, stating a reason (FR-209). Failed attempts on an unverified account count, so the unverified window is not a free guessing lane (OQ-57).
8. A wrong second-factor code leaves the user on the step to retype it and counts toward the same lockout (UC-194). The challenge is a sealed five-minute value, deliberately not single-use. Enrolling, answering and recovering with a second factor are FR-208's (UC-193 … UC-195).
9. A refresh token is consumed on use. Presenting a consumed one past the race grace reads as theft and revokes the session (§12.5.6, the page-load rotation paragraph of task 26.4). A session past its idle or absolute bound is 401 `session-expired`; one that never existed or was revoked is 401 `authentication-required` (`architecture.md` §6.2).
10. Sign-in exits per §4.3 (FR-12). A caller already holding a session is never served the sign-in form again: the destination is the branch (UX-136; task-112 row).

**Refusals.**
- Wrong credential, in any of its forms → 401 `credential-invalid`
- Correct password, address unverified → 403 `email-unverified`
- Account locked → 403 `account-locked`
- Too many attempts → 429 `rate-limited`
- Wrong, spent or expired second-factor code → 403 `factor-invalid`, one answer for all (task-27.3 rows)
- Refresh token unusable → 401 `authentication-required`; session over → 401 `session-expired`

**Effects.** A session row with its refresh token, its remembered flag and its active organization (FR-12). A successful password step clears the failure counter.

**Configuration-held values.** None. The window, the threshold and the lifetimes are §12.5.6 values held in code.

**Boundaries.** Registration through a provider is FR-2. Linking a provider is FR-8. Consuming a reset link is FR-6. The edge's 60 requests per minute for unauthenticated traffic is task 71.1's.

**Acceptance criteria.**
- **AC-1** Given an active account with no second factor and the correct password, then 201 `signed_in` is answered with a session scoped to that account's memberships. *(source: FR text; UC-04; §12.5.6 task-27.3 row)*
- **AC-2** Given the same account signing in through a linked provider, then the session is identical in scope to the password session. *(source: FR text; UC-05)*
- **AC-3** Given a person who asked to be kept signed in, then the session lasts up to 7 days idle and 30 absolute; given one who did not, 12 hours idle and absolute; given a provider sign-in, the remembered pair. *(source: OQ-35 as amended 4 Sep 2026)*
- **AC-4** Given a provider identity whose email has changed at the provider, then sign-in resolves to the same account. *(source: FR text; UC-05 rule; BR-ID-2)*
- **AC-5** Given an unknown address and a registered address with a wrong password, then the answer is the same 401. *(source: NFR-64; §12.5.6 limits table)*
- **AC-6** Given 10 consecutive failures, then the next attempt, with the correct password, is 403 `account-locked`. *(source: FR text; §12.5.6 limits table)*
- **AC-7** Given 5 attempts from one IP for one account inside 15 minutes, then the 6th is 429 whether or not the account exists. *(source: FR text; §12.5.6 limits table)*
- **AC-8** Given an unverified account, then the correct password answers 403 `email-unverified` and a wrong one answers 401, which counts toward the lockout. *(source: OQ-57)*
- **AC-9** Given an account with a second factor and the correct password, then a challenge is answered in place of a session, and a wrong code leaves the user on the step and counts toward the lockout. *(source: UC-194; §12.5.6 task-27.3 rows)*
- **AC-10** Given a provider identity linked to no account, then registration is offered and no account is created. *(source: UC-05 alternate flow)*
- **AC-11** Given a consumed refresh token presented past the race grace, then the session is revoked. *(source: `architecture.md` §12.5.6, the page-load rotation paragraph of task 26.4)*

**History.**
- 18 Aug 2026 · OQ-19 closed · 5 attempts per 15 minutes per (IP, account); lockout at 10 consecutive failures · `architecture.md` OQ-19, §12.5.6 limits table
- 21 Aug 2026 · project owner · tenant session 7 days idle and 30 absolute; the unverified-with-correct-password answer · `architecture.md` OQ-35, OQ-57; task 21's batch
- 26 Aug 2026 · project owner · one route with a discriminated answer; the challenge sealed in the body · §12.5.6 task-27.3 rows
- 4 Sep 2026 · project owner · two lifetime policies, chosen by the person; a provider session is always remembered · `architecture.md` OQ-35 as amended; §12.5.6 task-97 row
- 14 Sep 2026 · project owner · S-36's password step on S-02's path carries the same choice · §12.5.6 task-155 row (4)
- 25 Sep 2026 · project owner · the callback's `iss` travels with the code · §12.5.6 task-24 row, task 171
- 5 Oct 2026 · project owner · a Platform Administrator may release a locked tenant account, so the limits row's words *released by reset link or PA action* have a use case and a requirement behind them · §12.5.6 task-182 identity and organization row (182/1); FR-209
- 5 Oct 2026 · project owner · the second-factor step is specified by FR-208, not by NFR-95 alone · §12.5.6 task-182 identity and organization row (182/156)

### FR-5 — Sign out for real; resume after expiry

**Status.** Built — delivered 21, 22, 35.3, 92, 93, 160, 161

**Obligation.** The system shall terminate a session server-side on logout rather than only clearing it client-side, and on re-authentication after expiry shall return the user to the exact screen and record they were on, submitting any locally queued draft changes.

| | |
|---|---|
| **Actors** | CA. |
| **Traces** | UC-06, UC-07 · UC-35, UC-36 · UX-37, UX-38 · `architecture.md` AD-12, OQ-33, OQ-60 and §12.5.6's task-35.3, task-92, task-93, task-160, task-161 rows · NFR-38 · entity *Session* |
| **Surfaces** | The account menu's sign-out · S-07's inline re-authentication dialogue · S-01's `?return=` · `DELETE /auth/session` (204) · `POST /auth/session/refresh` · web Route Handlers under `/auth/session` · S-30 |

**Preconditions.** A session exists (sign-out), or one has just ended (resumption).

**Behaviour.**
1. Sign-out authenticates by the refresh token and so still works after the access token has expired. The refresh token is dead from then on whatever copies exist. It is idempotent and answers identically for a token that never existed (`DELETE /auth/session` description).
2. Sign-out sends what is unsent, or asks. It waits for the queue to drain, which NFR-38 budgets at 250 ms p95. Only when the queue cannot go — offline, refused, or the session ended — is UX-37's dialogue put to the reader, with a chance to cancel (task-93 row). S-36's and S-03's sign-outs have no queue behind them and are not covered.
3. In the wizard, a write answered 401, or a navigation from the module rail or the exit control, opens an inline dialogue over the preserved screen. It accepts the password and, as a second stage, a second-factor code or a recovery code. It is bound to the account the page was rendered for: another account's sign-in is refused, and a session already held is never replaced. The organization the page was read under is restored, and the reader stays on the step after resuming (task-92 row).
4. A change queued while the session is gone is refused with 401, kept under the account's key, and submitted once the reporter signs in again (task-35.3 row; FR-38).
5. Elsewhere, a request answered with an ended session — problem type `authentication-required` or `session-expired` on a request that carried the bearer — sends the reader to sign-in with the address they asked for as `?return=`. The api client answers this once for every request (task-161 row). A reload, a typed address and the global tier's own links take the same path (task-92 row (2)).
6. A password reset or a sign-out elsewhere ends the session this browser holds, and the exits from S-02 behave accordingly (task-160 row; `design_spec.md` S-02).
7. Signing out of the platform does not end the person's session at a social identity provider, and **the interface does not say so**: the sentence UC-06 required was struck on 5 Oct 2026, declined by the project owner, and was never built (§12.5.6 task-182 identity and organization row, 182/5).

**Refusals.**
- No usable token → 401 `authentication-required`
- Session over → 401 `session-expired`, the signal to refresh or re-authenticate in place (`architecture.md` §6.2)

**Boundaries.** The queue's mechanics are FR-38. Session lifetimes are FR-4's.

**Acceptance criteria.**
- **AC-1** Given a signed-out session, then its refresh token is refused server-side thereafter. *(source: FR text; UC-06; AD-12)*
- **AC-2** Given a session that expired under an open wizard step with queued changes, when the reader re-authenticates in the dialogue, then they stay on the same step and the queued changes are submitted. *(source: FR text; UC-07; §12.5.6 task-92 row)*
- **AC-3** Given the dialogue is open and another account signs in in a second tab, then that session is not replaced, and a different account is refused. *(source: §12.5.6 task-92 row)*
- **AC-4** Given a sign-out with a queue that can be sent, then it is sent before the session ends with no dialogue; given one that cannot, then a dialogue warns and offers to cancel. *(source: UX-37; §12.5.6 task-93 row)*
- **AC-5** Given a change queued while the session is gone, when the reader signs in again, then it is submitted. *(source: §12.5.6 task-35.3 row)*
- **AC-6** Given any screen whose read is answered with an ended session, then the reader is sent to sign-in with the asked address as the return destination. *(source: §12.5.6 task-161 row)*

**History.**
- 2 Sep 2026 · project owner · OQ-60 closed: task 92 owns the inline re-authentication and task 93 the sign-out flush; the queued-changes half was proved by task 35.3 · `architecture.md` OQ-60; §12.5.6 task-35.3 row
- 15 Sep 2026 · project owner · the dialogue accepts a password then a second factor, and is `apps/web`'s · §12.5.6 task-92 row
- 16 Sep 2026 · project owner · sign-out sends what is unsent, or asks · §12.5.6 task-93 row
- 21 Sep 2026 · project owner · one place answers a session the api has ended, replacing task 160's per-screen check · §12.5.6 task-161 row
- 5 Oct 2026 · project owner · the notice that a provider's session survives sign-out is declined and struck from UC-06; FR-5 is sign-out only · §12.5.6 task-182 identity and organization row (182/5); `use_cases.md` UC-06 amended

### FR-6 — Reset a forgotten password

**Status.** Built — delivered 21, 22, 67.11, 155, 160

**Obligation.** The system shall issue a single-use, time-limited password reset link, shall return an identical response whether or not the address is registered, and shall invalidate all existing sessions for the account when the link is consumed.

| | |
|---|---|
| **Actors** | CA. |
| **Traces** | UC-08, UC-09 · BR-ID-5 · `architecture.md` OQ-56 and §12.5.6's task-67.11 and task-155 rows · NFR-64 · UX-108 · entity *Password reset token* |
| **Surfaces** | S-02 (the request and the new-password step) · `POST /auth/password-reset-email` (202 · 400 · 429) · `POST /auth/password-reset` (204 · 400) |

**Inputs.** An address (the request); the token and a new password (the consumption).

**Behaviour.**
1. The request answers 202 with an empty body, identical whether the address is unregistered, unverified or registered. Rate limiting is identical either way (NFR-64).
2. A link is sent to a verified account, and equally to an account holding no password and to one still in setup (UC-08 as amended 14 Sep 2026). The message and S-02's page are worded as *setting* a password for such an account (task-155 row (8)).
3. The link lasts 60 minutes and is single-use. A newer request supersedes an older one.
4. Consuming it requires a password within the policy (FR-1), replaces the credential, revokes every session the account holds, and releases a lockout (FR-4). No session is issued: the person signs in.
5. A social-only account completing the flow gains a password beside its linked identity. This is the recovery path when its only provider is disabled (UC-09; task-67.11 row (3)). An account in setup that completes it sets the password half of its setup (task-155 row).
6. A locked account may always request a link, because consuming one is what releases the lock (`POST /auth/password-reset-email` description).
7. S-02 states the consequence before it happens — that every session ends. A reset completed on a device that holds another account's session says so and offers to switch or stay (`design_spec.md` S-02; task-160 row).
8. Reset and set-password stay reachable to a signed-in reader, since a link opens on whatever device is to hand (UX-136; task-112 row).

**Refusals.**
- Password outside the policy → 400 `validation-failed`
- Link never issued, used, lapsed or superseded → 400 `reset-token-invalid` (`identity.password_reset.token_invalid`), one answer for all
- Too many requests for this address in the window → 429 `rate-limited`, identical for registered and unregistered addresses

**Effects.** Sessions revoked with reason `password_reset`; the failure counter and the lock cleared.

**Configuration-held values.** The email's category is `identity.password_reset` (email, transactional). The 60 minutes is a §12.5.6 value.

**Boundaries.** Changing the password while signed in is FR-7. The edge's share of the request's rate limiting is task 71.1's.

**Acceptance criteria.**
- **AC-1** Given a registered and an unregistered address, then the request answers the same 202. *(source: FR text; UC-08; BR-ID-5)*
- **AC-2** Given a valid link and a policy-conforming password, then the password is replaced and no prior session of the account is valid. *(source: FR text; UC-09)*
- **AC-3** Given a link used once, then using it again is refused with 400. *(source: FR text)*
- **AC-4** Given a link older than 60 minutes, then it is refused with 400. *(source: FR text; §12.5.6 lifetimes row)*
- **AC-5** Given a locked account, when its reset link is consumed, then the lock is released. *(source: §12.5.6 limits table)*
- **AC-6** Given an account holding only a linked provider, then the same request sends it a link, and completing it gives it a password. *(source: UC-08, UC-09 as amended 14 Sep 2026)*
- **AC-7** Given an account in setup, then the request sends it a link worded as setting a password. *(source: §12.5.6 task-155 row (8))*
- **AC-8** Given a newer request for the same address, then the older link is refused. *(source: the OpenAPI description of `POST /auth/password-reset`)*

**History.**
- 21 Aug 2026 · project owner · FR-6 lands in task 21, because the reset link is the only lockout release before the console · `architecture.md` OQ-56
- 14 Sep 2026 · project owner · a social-only account gains a password by the same link · §12.5.6 task-67.11 row (3); UC-08, UC-09 amended
- 14 Sep 2026 · project owner · the message and S-02 are worded for an account holding no password; a reset admits an account in setup · §12.5.6 task-155 row (8)

### FR-7 — Change own password

**Status.** Built — delivered 27.5, 27.7, 137, 169

**Obligation.** The system shall allow an authenticated user to change their password by supplying the current one, with optional termination of their other active sessions.

| | |
|---|---|
| **Actors** | CA. |
| **Traces** | UC-10 · `architecture.md` OQ-56 and §12.5.6's task-27.5 rows · NFR-64 · entity *Session* |
| **Surfaces** | S-28 (the password row opens in place) · `GET /account/password` (200) · `POST /account/password` (200 · 400 · 403 · 429) |

**Preconditions.** The user is authenticated and holds a password credential (UC-10).

**Inputs.** The current password, a new password, and whether to terminate the other sessions.

**Behaviour.**
1. The new password must meet the policy (FR-1). The current password is asked inside the row the reader opened (`design_spec.md` S-28).
2. Termination is opt-in and spares the session making the change, so the user is not signed out of the device they used (task-27.5 rows). The sessions it ends carry the reason `password_changed`, distinct from `password_reset`.
3. Every route that asks for the current password behind a session shares one throttle: 5 attempts per 15 minutes per (IP, account), under its own key. It is deliberately not wired to the lockout, because a mistyped password on a settings screen must not sign the user out of every device (task-27.5 row).
4. `GET /account/password` answers whether a password is held and when it last changed (task 169).

**Refusals.**
- Current password wrong → 403 `credential-invalid` (`identity.totp.reauthentication_failed`), not counted toward the lockout
- New password outside the policy → 400 `validation-failed`
- Too many attempts → 429 `rate-limited`

**Boundaries.** A forgotten password is FR-6. The other credential changes on S-28 are FR-8's.

**Acceptance criteria.**
- **AC-1** Given a wrong current password, then the change is refused and nothing changes. *(source: FR text; UC-10)*
- **AC-2** Given the correct current password and a conforming new one, then the password is replaced. *(source: FR text; UC-10)*
- **AC-3** Given the user elects termination, then every other session of the account ends and the current one continues. *(source: FR text; §12.5.6 task-27.5 row)*
- **AC-4** Given the user does not elect it, then no other session is ended. *(source: FR text)*
- **AC-5** Given 5 attempts in 15 minutes from one IP for one account, then the 6th is 429, and no failure locks the account. *(source: §12.5.6 task-27.5 row)*

**History.**
- 21 Aug 2026 · project owner · FR-7 assigned to the security-settings slice, task 27 · `architecture.md` OQ-56
- 27 Aug 2026 · project owner · one throttle key for the routes that ask for the password, not wired to the lockout; a fourth revocation reason · §12.5.6 task-27.5 rows
- 24 Sep 2026 · project owner · the password row shows the date it last changed · task 169 row

### FR-8 — Link and unlink provider identities

**Status.** Built — delivered 24, 27.6, 27.7, 169, 171

**Obligation.** The system shall allow provider identities to be linked to and unlinked from an existing account, shall require authentication by an existing credential before a link is established, and shall refuse removal of the last remaining credential.

| | |
|---|---|
| **Actors** | CA. |
| **Traces** | UC-11, UC-12 · BR-ID-3, BR-ID-4 · D-6 · `architecture.md` §12.5.6's task-27.6 and task-171 rows · UX-70 · entity *Provider identity* |
| **Surfaces** | S-28 (linked identities; the pending-confirmation state) · `GET /account/providers` · `POST /account/providers/{provider}` (204 · 403 · 409 · 429) · `POST /account/providers/{provider}/removal` (204 · 403 · 409) · `POST /auth/social/{provider}/challenge` |

**Preconditions.** The user is authenticated by their existing credential (UC-11).

**Behaviour.**
1. The authorization half is the sign-in flow's, reused unchanged; only the completion is new and authenticated. The intent `link` tells the web tier's sealed transaction which completion to call (task-27.6 row).
2. Linking and unlinking both require the current password, on the shared re-authentication key (FR-7). A link adds a way in, and a stolen session that could attach a provider would outlive the password change its owner reaches for.
3. The password is asked after the provider round trip, in a *pending confirmation* state, and is never carried across the redirect (`design_spec.md` S-28). A refused password leaves the link confirmable on a retype (task 171).
4. A provider assertion alone never attaches to an existing account; a register-intent collision refuses and directs the user to sign in and link (BR-ID-3; task-27.6 row).
5. The last credential is counted over both kinds, the password row plus the provider identities, inside the same transaction as the delete. Unlinking is refused when it would leave none. An account with a password and one provider may unlink it (BR-ID-4; task-27.6 row). S-28 withholds the unlink for the last way in and names it before the reader tries (task 169).
6. A provider identity already attached to another account is refused without saying whose.
7. Since task 155 every active account holds a password (§12.5.6 task-92 row (1)). The refusal stays the rule's guard.

**Refusals.**
- Current password wrong → 403 `credential-invalid`
- The (provider, subject) pair is attached to an account already → 409 `conflict` (`identity.social.identity_taken`)
- The provider is not linked to this account → 409 `conflict` (`identity.social.not_linked`)
- Removal would leave no credential → 409 `conflict` (`identity.social.last_credential`)
- Too many attempts → 429 `rate-limited`

**Boundaries.** Registration through a provider is FR-2. Withdrawing a provider platform-wide is FR-82.

**Acceptance criteria.**
- **AC-1** Given a provider assertion and no existing credential proof, then no link is established. *(source: FR text; BR-ID-3; UC-11)*
- **AC-2** Given a linked provider, then either credential signs the user in. *(source: FR text; UC-11 postcondition)*
- **AC-3** Given an account whose removal would leave no credential, then it is refused with 409 and nothing is removed. *(source: FR text; BR-ID-4)*
- **AC-4** Given an account with a password and one provider, then unlinking the provider is permitted. *(source: §12.5.6 task-27.6 row)*
- **AC-5** Given a mistyped password on a pending link, then the link stays confirmable on a retype. *(source: task 171 row)*
- **AC-6** Given a provider identity attached to another account, then the link is refused without naming that account. *(source: task-27.6 row, error docblock)*

**History.**
- 24 Aug 2026 · project owner · FR-8 moves to task 27, because S-28 carries FR-7 and FR-8 on one screen · task 24's batch
- 27 Aug 2026 · project owner · both operations require the current password; the last credential is counted over both kinds · §12.5.6 task-27.6 rows
- 25 Sep 2026 · project owner · a refused password does not spend the link · task 171 row

### FR-208 — The opt-in second factor

**Status.** Partial — delivered 27.1, 27.2, 27.3, 27.4, 27.5, 27.7, 27.8, 92, 97, 143 · remaining 190 (the Organization Administrator's prompt to enrol, and the count of recovery codes left after a recovery sign-in)

**Obligation.** The system shall let any signed-in user add a time-based one-time code (TOTP) as a second factor to their own account, take effect only once a current code from it has been returned, and be given ten single-use recovery codes, shown once; shall challenge an account that holds the factor for a current code, or for a recovery code, after the correct password and before any session exists, and never challenge an account that does not hold it; and shall let the user turn the factor off or replace the whole set of recovery codes. The factor is opt-in, is not enforced at MVP, and is recommended to Organization Administrators.

| | |
|---|---|
| **Actors** | Any authenticated user, on their own account, whatever role they hold (Common Access). An Organization Administrator is additionally prompted to enrol. The operators' own factor is FR-75 and FR-80's, not this one. |
| **Traces** | UC-193, UC-194, UC-195 · NFR-95 (the quality), NFR-64, NFR-65 · FR-4, FR-5, FR-7, FR-8 · UX-108 · `architecture.md` §12.5.6's task-27.1, task-27.2, task-27.3 (both rows), task-27.5, recovery-code, enrolment-confirmation, task-97 and task-143 rows · `design_spec.md` S-28, S-01 · entity *Account* |
| **Surfaces** | S-28 (enrol, turn off, re-issue; the state) · S-01's second-factor step at `/sign-in/factor` · S-07's inline re-authentication dialogue, as its second stage (FR-5) · `GET /account/totp` (200) · `POST /account/totp/enrolment` (201 · 403 · 409 · 429) · `POST /account/totp/confirmation` (201 · 403 · 409 · 429) · `POST /account/totp/removal` (204 · 403 · 409 · 429) · `POST /account/totp/recovery-codes` (201 · 403 · 409 · 429) · `POST /auth/session/factor` (201 · 403 · 429) |

**Preconditions.** To enrol: the user is authenticated and holds no confirmed factor (UC-193). To be challenged: the account holds a confirmed factor and the correct password has just been presented (UC-194). To recover: the account holds a confirmed factor and an unspent recovery code (UC-195).

**Inputs.** The current password (enrolment, turning off, re-issue). A six-digit code (confirmation, challenge). For the challenge, the sealed challenge from the first step and one `code` field that takes either a current code or a recovery code (sixteen characters, typed with or without its four-by-four grouping, in any case, with the confusable letters folded).

**Behaviour.**
1. **Enrolment is two steps, and the factor is in force only after the second.** Step one asks for the current password and issues a secret, returned once, with the `otpauth://` address an authenticator scans (RFC 6238: SHA-1, six digits, a thirty-second step, one step either side), filed under the name EasyESG. The secret is stored inert and encrypted at rest. An abandoned enrolment leaves the account as it was (§12.5.6 task-27.1 and task-27.2 rows; task 143; UC-193 exception flows).
2. **Step two returns a current code from that secret** and needs no password, the first step having taken it moments ago. It activates the factor and issues the recovery codes, shown exactly once (§12.5.6 task-27.2 row; UC-193 step 4). The step is bounded at 5 attempts per 15 minutes under its own key, and does not feed FR-4's lockout, because the caller holds a session (§12.5.6 enrolment-confirmation row).
3. **Recovery codes are ten per issue**, sixteen Crockford base32 characters each (about 80 bits), stored as SHA-256 digests and single-use. Re-issuing replaces the whole set, so a code from an earlier set stops working at once (§12.5.6 recovery-codes row).
4. **Enrolling, turning off and re-issuing ask for the current password**, because a second factor is the control that survives a compromised session, so a compromised session must not install or strip one. A wrong password is not a failed sign-in and does not count toward the lockout. All three share the password change's window of 5 attempts per 15 minutes per (IP, account) (§12.5.6 task-27.2 and task-27.5 rows).
5. **A confirmed factor cannot be enrolled over.** The way to a new secret is to turn the factor off and enrol again, which costs the password twice. Turning off removes the factor and its recovery codes together (UC-193 business rules; task-27.2 row).
6. **The challenge replaces the session, never adds a step to an account with no factor.** `POST /auth/session` answers `challenge` in place of `signed_in` for an account that holds the factor, and the first step discloses no more than a correct password already does (FR-4 behaviour 1; UC-194; NFR-64).
7. **The second step takes the challenge and one code.** A current code and a recovery code are told apart by their shape. A wrong, spent or unrecognised code, an expired challenge and a challenge this api did not issue are one answer, 403 `factor-invalid`. The account's lock is read before the code is judged, a wrong code counts toward FR-4's lockout, and the step is bounded by the auth-path window (FR-4 behaviour 8; §12.5.6 task-27.3 rows, amended 27 Aug 2026).
8. **A recovery code grants one session and removes nothing.** The factor stays in force; the user may then turn it off or re-issue the codes (UC-195 business rules).
9. **The state read carries a yes or no and a count, never the secret or a code.** An enrolled account with zero codes left is a designed state: S-28 says what it means for the day the authenticator is lost (`GET /account/totp` description; UC-195 exception flows).
10. **Two parts of the use cases are not built**: a recovery sign-in does not tell the user how many codes remain (UC-195 step 3), and an Organization Administrator without the factor is not prompted to enrol (UC-193 trigger; NFR-95). 190 owns both.

**Refusals.**
- The current password is wrong or absent on enrolment, turning off or re-issue → 403 `credential-invalid` (`identity.totp.reauthentication_failed`)
- A code that is not current, at confirmation or at the challenge → 403 `factor-invalid` (`identity.totp.code_invalid`)
- Enrolling when a confirmed factor exists → 409 `conflict` (`identity.totp.already_enrolled`)
- Confirming with no enrolment awaiting, or turning off or re-issuing with no factor → 409 `conflict` (`identity.totp.not_enrolled`)
- Too many attempts in the window → 429 `rate-limited`
- The challenge on a locked account → 403 `account-locked`
- No usable session on a management route → 401 `authentication-required`

**Effects.** An encrypted secret, inert until confirmed. Ten recovery-code digests per issue. The failure counter of FR-4 moves only on the challenge.

**Configuration-held values.** None. The algorithm parameters, the ten codes, the windows and the five-minute challenge are §12.5.6 values held in code. The issuer name EasyESG is a constant.

**Boundaries.** Signing in is FR-4, whose lockout this step feeds. The inline re-authentication dialogue that accepts a code is FR-5's. Linking a provider applies the same password rule (FR-8). The operators' own factor is mandatory and separate (NFR-65; FR-75, FR-80).

**Acceptance criteria.**
- **AC-1** Given a signed-in user with no factor and the correct password, when enrolment begins, then a secret and its address are returned once and the account still signs in without a challenge. *(source: UC-193 steps 1 and 2; §12.5.6 task-27.2 row)*
- **AC-2** Given a begun enrolment, when a code that is not current is returned, then the answer is 403 `factor-invalid`, the factor is not in force and the secret is unused. *(source: UC-193 exception flows)*
- **AC-3** Given a begun enrolment, when a current code is returned, then the factor is in force, ten recovery codes are returned once, and the state read shows the factor and ten codes. *(source: UC-193 step 4; §12.5.6 recovery-codes row)*
- **AC-4** Given a wrong or absent password, when a user enrols, turns the factor off or re-issues the codes, then the answer is 403, nothing changes and the lockout counter is untouched. *(source: §12.5.6 task-27.2 and task-27.5 rows)*
- **AC-5** Given an account holding a confirmed factor, when enrolment is begun again, then the answer is 409 and the secret in force is unchanged. *(source: §12.5.6 task-27.2 row; `TotpAlreadyEnrolledError`)*
- **AC-6** Given an account with no factor and the correct password, then a session is issued and no challenge. *(source: UC-194 business rules; FR-4 AC-1)*
- **AC-7** Given an account with the factor and the correct password, then a challenge is answered in place of a session, and a current code returns the session. *(source: UC-194 steps 1 to 3)*
- **AC-8** Given a wrong code at the challenge, then the answer is 403 `factor-invalid`, the user may retype on the same challenge, and the failure counts toward the lockout. *(source: UC-194 exception flows; FR-4 AC-9)*
- **AC-9** Given a challenge older than five minutes, or one this api did not issue, then the answer is 403 `factor-invalid` and nothing is revealed about which. *(source: §12.5.6 task-27.3 rows; `POST /auth/session/factor` description)*
- **AC-10** Given a recovery code at the challenge, then a session is issued, the code is spent and the factor stays in force; given the same code again, then 403 `factor-invalid`. *(source: UC-195 steps 1 and 2, business rules)*
- **AC-11** Given a re-issue, then ten new codes are returned once and every earlier code is refused. *(source: §12.5.6 recovery-codes row; `POST /account/totp/recovery-codes` description)*
- **AC-12** Given the factor is turned off with the current password, then it and its codes are gone and the next sign-in is not challenged. *(source: UC-193 business rules; §12.5.6 task-27.2 row)*
- **AC-13** Given a sixth confirmation, or a sixth password-gated attempt, in 15 minutes, then the answer is 429 and the account is not locked. *(source: §12.5.6 task-27.5 and enrolment-confirmation rows)*
- **AC-14** Given the state read, then it carries whether the factor is in force and the codes remaining, and never the secret or a code. *(source: `GET /account/totp` description)*
- **AC-15** Given an enrolled account with no recovery code left, then S-28 says so and what it means. *(source: UC-195 exception flows; `design_spec.md` S-28)*
- **AC-16** Given a recovery sign-in, then the user is told how many codes remain. *(source: UC-195 step 3)* Unmet until 190.
- **AC-17** Given an Organization Administrator who holds no factor, then they are prompted to enrol. *(source: NFR-95 verification; UC-193 trigger)* Unmet until 190.

**History.**
- 26 Aug 2026 · project owner · opt-in tenant TOTP is MVP scope (NFR-95, 18 Aug); UC-193 … UC-195 appended; enrolment is two steps; enrolling and turning off need the password; ten recovery codes · §12.5.6 task-27.2 and recovery-codes rows
- 26 Aug 2026 · project owner · one sign-in route, a discriminated answer, the challenge sealed in the body · §12.5.6 task-27.3 rows
- 27 Aug 2026 · project owner · the password-gated routes and the confirmation are bounded, neither feeding the lockout · §12.5.6 task-27.5 and enrolment-confirmation rows
- 4 Sep 2026 · project owner · the remembered choice rides the sealed challenge · §12.5.6 task-97 row
- 12 Sep 2026 · project owner · the authenticator is shown a scannable symbol and a name of its own · task 143
- 5 Oct 2026 · project owner · the second factor is a requirement of its own, FR-208, with UC-193 … UC-195 as its source, and no longer left to NFR-95 alone · §12.5.6 task-182 identity and organization row (182/156)

### FR-209 — Release a locked tenant account

**Status.** Not started — delivered none · remaining 67.12

**Obligation.** The system shall let a Platform Administrator release a tenant account that FR-4's lockout has locked, stating a reason, so that the person can sign in again without waiting on the reset link, and shall record the release against the administrator in the system audit log.

| | |
|---|---|
| **Actors** | A Platform Administrator, on A-02. A Billing Operator is refused. The locked person is not an actor here: the reset link (FR-6) is theirs and stays. |
| **Traces** | UC-214 · FR-4, FR-6, FR-76, FR-80, FR-81, FR-159 · FR-78 (the reason's length) · FR-22 (the reason's form) · `architecture.md` §12.5.6 limits table, OQ-56 |
| **Surfaces** | A-02's organization record, in the list of its members · a route beside `POST …/members/{accountId}/phone-disclosure`, which task 67.12 names and the contract then emits |

**Preconditions.** An elevated session (UC-68). The account is locked: its sign-in answers 403 `account-locked`.

**Inputs.** The account, chosen from the member list of an organization it belongs to, and a reason. The reason is mandatory, at most 500 characters as A-07's is (FR-78), trimmed, and whitespace is not a reason, as FR-22's reopening reason is.

**Behaviour.**
1. The release clears the lock and the failure count together, so the person is given the whole of FR-4's threshold back rather than one attempt before locking again. This is the shape of the operator realm's release (FR-80 behaviour 6).
2. A release for an account that is not locked is refused and not answered as success, so the audit row never records a change that did not happen (FR-80 behaviour 6).
3. Every release is one row in `audit.system_audit_log` under its own action, naming the operator and the account, with the reason recorded alongside (FR-81 behaviour 2; FR-159). Like every Platform Administrator action it is audited and needs a stated reason.
4. The release changes account state and nothing of an organization's report content, so it needs no support-access grant (FR-77; the reasoning of FR-76 behaviour 7).
5. The reset link stays the person's own release and needs no one (FR-4 behaviour 7). This route is the second, for the person who cannot use it.

**Refusals.**
- A Billing Operator → 403 `insufficient-role`
- No reason, a blank one, or one over 500 characters → 400 `validation-failed`
- An account that is not locked → 409 `conflict`
- An unknown organization, or an account that is not its member → 404 `not-found`

**Effects.** `locked_at` and the failure count cleared on the account. One system audit row.

**Boundaries.** The lock and its threshold are FR-4's. Releasing an operator's own lock is FR-80's and A-08's. An account that belongs to no organization has no row on A-02, and its owner uses the reset link. No notice reaches the released person; if one is wanted, it is a notification category (FR-163).

**Acceptance criteria.**
- **AC-1** Given a locked tenant account, when a Platform Administrator releases it on A-02 with a reason, then the next sign-in with the correct password is not refused as locked, and the failure count is zero. *(source: §12.5.6 task-182 identity and organization row, 182/1; FR-80 behaviour 6)* Unmet until 67.12.
- **AC-2** Given a release with no reason, a blank one or one over 500 characters, then the answer is 400 and the account stays locked. *(source: §12.5.6 task-182 identity and organization row, 182/1; FR-78; FR-22)* Unmet until 67.12.
- **AC-3** Given an account that is not locked, then the release is refused with 409 and no audit row is written. *(source: FR-80 behaviour 6)* Unmet until 67.12.
- **AC-4** Given a release, then exactly one system audit row names the operator, the account, the action and the time, and the reason can be read from it. *(source: §12.5.6 task-182 identity and organization row, 182/1; FR-81 behaviour 2)* Unmet until 67.12.
- **AC-5** Given a Billing Operator, then the release is refused with 403. *(source: FR-76; `actors.md` §5)* Unmet until 67.12.

**History.**
- 5 Oct 2026 · project owner · a Platform Administrator may release a locked tenant account on A-02, stating a reason; chosen over striking *or PA action* from the limits row · §12.5.6 task-182 identity and organization row (182/1); UC-214 added

## 2. Profile and membership (index §3.2)

### FR-9 — The personal profile

**Status.** Partial — delivered 52.1, 52.3, 139, 140, 155.2, 167 · remaining 75.3 (the privacy notice names the phone), 185 (a name part with no visible character, at registration)

**Obligation.** The system shall maintain a personal profile — a given name and a family name, the contact email, an optional job title and an optional phone number, and the notification preferences — held independently of any organization the user belongs to, capturing the two name parts at registration and allowing them to be edited afterwards. The display name is derived from the two parts and is not stored. The contact email is the sign-in address, shown and not a second address. The per-category structure of the preferences is FR-163's.

| | |
|---|---|
| **Actors** | CA edits their own profile. A Platform Administrator may read a member's phone on A-02, one reveal at a time. |
| **Traces** | UC-13, UC-168 · `design_spec.md` UX-137, OQ-16 · `architecture.md` §12.5.6's task-139, task-52.1, task-52.3, task-167 rows · NFR-28, NFR-30 · entity *User profile* |
| **Surfaces** | S-27 (Record) · S-36 (names at setup) · S-01's register step · the account menu, S-05 and S-16, which show the derived name · `GET /account/profile` (200) · `PUT /account/profile` (200 · 400) · `GET`, `PUT /account/notification-preferences` |

**Preconditions.** The user is authenticated (UC-13).

**Behaviour.**
1. The profile is personal to the user and does not change when the active organization does (UC-13).
2. Both name parts are required at registration, at setup and on S-27 (§12.5.6 task-52.3 row, build notes). Setup and S-27 trim each part and refuse one with no visible character, and so does registration (§12.5.6 task-182 identity and organization row, 182/6; 185 builds it). A provider sign-up seeds them from the assertion's single display name where they are empty and never overwrites; nothing splits it (task-139 row; UX-137).
3. The display name is `given family`, with one part standing alone when the other is absent and the email address standing in when both are. The monogram is the first character of each part present. It is derived in the session, in the account and member responses, and a second time in SQL because S-16's person column sorts on it; a test holds the two equal (UX-137; task-140 row).
4. The job title and the phone number are optional, and an omitted, null or blank value clears them. A phone is stored as `+` and the digits (E.164), and the api strips the separators a person types. The phone is used only for support to reach the person about their account (task-52.3 row (4)).
5. The contact email is the sign-in address. S-27 shows it and does not edit it, so no address the platform writes to is unconfirmed (task-52.3 row (2)).
6. S-27 saves the profile and the preferences behind one Save, preferences first. A new interface language ends the write in a navigation to the screen in that language, and a save renews the session so the global tier's name changes at once. The display name S-27 shows is the api's, re-read after a save (task-52.3 row).
7. The name columns carry no field-change trail: they are personal profile data, and FR-54 and FR-55 govern disclosure attribution inside an organization (task-139 row).
8. A Platform Administrator reads a member's phone behind a *Show* control on A-02, one person at a time. Each reveal writes one row to the system audit log, naming the operator and whose phone. No support-access grant is needed, because the phone was given for exactly that (task-167 row).

**Refusals.**
- A missing name part, or on S-27 and in setup a part with no visible character → 400 `validation-failed` (`identity.profile.names_required`, `identity.setup.names_required`)
- A phone not in international form → 400 `validation-failed` (`identity.profile.phone_malformed`)
- A language the platform has not registered → 400 `validation-failed`

**Effects.** The account row carries `given_name`, `family_name`, the job title, the phone and three languages (FR-10; FR-52; FR-169).

**Configuration-held values.** None.

**Boundaries.** The notification preferences' structure, mandatory categories and unsubscribing are FR-163's. The email language and the export default language are stored on this record and read by dispatch (task 52.2) and by exports (task 47.2; FR-52, FR-169). The interface language is FR-10's. Erasing the profile is FR-207's.

**Acceptance criteria.**
- **AC-1** Given a profile saved in one organization, then it reads identically after the active organization is switched. *(source: FR text; UC-13)*
- **AC-2** Given both name parts, either one alone, or neither, then the derived display name is `given family`, the part present, or the address, and the monogram follows. *(source: UX-137)*
- **AC-3** Given a given name or family name missing on S-27, at registration or in setup, then the save is refused with 400 and nothing is stored. A part with no visible character is refused on S-27 and in setup, and at registration too (§12.5.6 task-182 identity and organization row, 182/6), which is unmet until 185. *(source: §12.5.6 task-52.3 row, build notes; task-139 row)*
- **AC-4** Given a provider assertion carrying one display name, then the name parts are seeded where empty and an existing value is never overwritten. *(source: §12.5.6 task-139 row)*
- **AC-5** Given a phone typed with spaces, then it is stored as `+` and digits, and one not in international form is refused. *(source: §12.5.6 task-52.3 row)*
- **AC-6** Given S-27, then the contact email is shown and cannot be edited. *(source: FR text; §12.5.6 task-52.3 row (2))*
- **AC-7** Given a reveal of a member's phone on A-02, then exactly one audit row records the operator and the person. *(source: §12.5.6 task-167 row)*
- **AC-8** Given the privacy notice, then it states what the phone is kept for and who reads it. *(source: §12.5.6 task-167 row (2))* Unmet until 75.3.

**History.**
- 12 Sep 2026 · project owner · two name parts rather than one; the display name derived; closes `design_spec.md` OQ-16's name half · §12.5.6 task-139 row; UX-137
- 23 Sep 2026 · project owner · optional job title and phone; the contact email is the sign-in address · §12.5.6 task-52.3 row (2), (4)
- 23 Sep 2026 · project owner · the phone is read by support one reveal at a time · §12.5.6 task-52.3 row (5), task-167 row
- 5 Oct 2026 · project owner · registration refuses a name part with no visible character, as setup and S-27 already do · §12.5.6 task-182 identity and organization row (182/6)

### FR-10 — Interface language

**Status.** Partial — delivered 19, 22, 52.3 · remaining 76.2 (the recorded fallback for FR-61 content)

**Obligation.** The system shall persist a per-user interface language across devices and sessions, falling back per string to the default locale where a translation is absent and recording each fallback.

| | |
|---|---|
| **Actors** | CA. |
| **Traces** | UC-14 · `architecture.md` OQ-32, OQ-43, OQ-46 · NFR-4, NFR-23 · FR-63, FR-64 · entity *User profile* |
| **Surfaces** | S-27's language control · S-01's register step · `PUT /account/profile` (`locale`) |

**Preconditions.** The locale is registered (UC-14; UC-73).

**Behaviour.**
1. The live locales are Romanian (the source), English and Russian, each separately authored (`locale-registration.global.json`; NFR-23). The choice persists on the account (S-27).
2. A new account's interface language is the locale negotiated from `Accept-Language` at registration, the one ambient value the registration command leaves to the service (OQ-46; root `CLAUDE.md`, the application-boundary convention). The web tier forwards its active locale to the api, which resolves wording server-side (OQ-46).
3. The URL is authoritative for rendering. The profile preference is the default a bare path redirects to: the session writes the `NEXT_LOCALE` cookie at sign-in from the profile, and ordinary detection serves the rest (OQ-32).
4. For catalogue text a missing translation cannot ship: a key absent from a locale fails the build (FR-64; OQ-43). For FR-61 content the per-string fallback to the default locale is live and reports the gap (FR-64).
5. The interface language is independent of the language of exports (UC-14 rule; FR-52) and of the language of email (FR-169). S-27 sets the three independently, and a new account's other two start as its interface language (task-52.3 row (3)).

**Refusals.** A locale the platform has not registered → 400 `validation-failed`.

**Boundaries.** The fallback queue for FR-61 content is FR-64's. Email and export languages are FR-169 and FR-52.

**Acceptance criteria.**
- **AC-1** Given a language chosen on S-27, then it applies at the next sign-in on any device. *(source: FR text; UC-14; OQ-32)*
- **AC-2** Given a locale that is not registered, then the save is refused with 400. *(source: UC-14 precondition)*
- **AC-3** Given a catalogue key present in the source locale and absent from another, then the build fails. *(source: FR-64; OQ-43)*
- **AC-4** Given an FR-61 string with no translation in the chosen locale, then it renders in the default locale and the gap is recorded. *(source: FR text; UC-14 alternate flow)* Unmet until 76.2.
- **AC-5** Given the three languages on S-27, then changing one does not change the others. *(source: §12.5.6 task-52.3 row (3))*

**History.**
- 18 Aug 2026 · project owner · the URL is authoritative; the profile preference is the default · `architecture.md` OQ-32
- 19 Aug 2026 · project owner · for catalogue text the fallback is unreachable by construction · `architecture.md` OQ-43; FR-10's index note
- 23 Sep 2026 · project owner · three languages, chosen independently · §12.5.6 task-52.3 row (3)

### FR-11 — Accept an invitation

**Status.** Built — delivered 25.1, 26.2, 26.3, 114, 142, 155

**Obligation.** The system shall accept an organization invitation bound to the invited email address, single-use and expiring, granting the assigned edit or view-only role on acceptance and making the organization joined the session's active organization.

| | |
|---|---|
| **Actors** | CA, the invited person. |
| **Traces** | UC-15 · UC-60, UC-61 · BR-ACC-2 · `architecture.md` §6.5 and §12.5.6's task-26.2, task-26.3, task-114, task-141, task-142 rows · NFR-64 · entity *Invitation* |
| **Surfaces** | S-03 (Focus) · S-01's hand-off (`?return=` and the invitation on the registration route) · `POST /invitations/preview` (200; public) · `POST /invitations/acceptance` (201 · 403 · 409 · 410 · 503; the throttle's 429 is not yet in the contract's list) |

**Preconditions.** A single-use, unexpired invitation issued by FR-57 exists for the invited address.

**Inputs.** The token from the link, in the body.

**Behaviour.**
1. The preview reads the invitation without using it, signed in or not, and answers the inviting organization, the role and a `standing`: acceptable, expired, consumed, revoked or unknown. A bearer-read policy on the invitation row serves it (task-26.2 row). The preview carries no application throttle; the edge bounds it, as it does registration and verification (task-26.2 row).
2. The invitation rides the URL across S-03, S-01 and back, as `?return=` plus an invitation parameter on the registration route (task-26.3 row). Acceptance is an explicit POST.
3. Acceptance needs a session. The signed-in account's address must be the invited one; a social sign-in as any other address, and an existing session for any other address, are the same refusal (`design_spec.md` S-03; UC-15).
4. On acceptance the membership is created at the invited role, scoped to that organization, and the session's `active_organization_id` is written to it (task-26.2 row).
5. An address that is already an **active** member consumes the invitation, leaves the member's role untouched, and succeeds. A **removed** member's row is reactivated at the invited role (task-26.2 row; §6.5, task 25.1).
6. The seat ceiling is checked only where acceptance creates or restores a membership. It refuses only an organization already over its ceiling — one that lowered the value after issuing — and rolls the acceptance back whole, so the invitation stays pending and the same link works afterwards. The invitee's refusal carries no `limit` or `used` (task-142 row).
7. Acceptance is throttled at 5 attempts per 15 minutes per (IP, account); a sixth is 429 while the person the invitation names is unaffected. The refusals are thrown after the commit so the attempt row survives (task-26.2 row; task-141 row).
8. A signed-in reader is never told to sign in. The remedy under an unusable link is their own home page, or, where the session ended while accepting, sign-in carrying the way back to the invitation (task-114 row).
9. An invitee who registers through a provider completes setup first and returns to the invitation (FR-2).

**Refusals.**
- Signed in as another address → 403 `invitation-address-mismatch`
- Spent, withdrawn, lapsed or unmatched → 410 `invitation-not-acceptable`, carrying `standing` (expired · consumed · revoked · unknown)
- Organization over its seat ceiling → 409 `entitlement-quota-exceeded`
- Seat ceiling unreadable → 503 `seat-allowance-unavailable`
- Too many attempts → 429 `rate-limited`
- No session → 401 `authentication-required`

**Effects.** A `membership` row (or a reactivated one), the invitation marked consumed, and the session's active organization changed.

**Configuration-held values.** The seat ceiling is `seat-allowance.global.json` (FR-57). The invitation's 7 days is a §12.5.6 value.

**Boundaries.** Issuing, resending and revoking is FR-57. The membership's role changes are FR-58.

**Acceptance criteria.**
- **AC-1** Given a live invitation and an account signed in with the invited address, when accepted, then the account holds the assigned role in that organization and its session acts for that organization. *(source: FR text; UC-15; §12.5.6 task-26.2 row)*
- **AC-2** Given a session for any other address, then acceptance is refused with 403 and nothing is granted. *(source: FR text; UC-15)*
- **AC-3** Given an accepted invitation, then a second use is refused with 410 `invitation-not-acceptable`, its `standing` reading consumed. *(source: FR text; §12.5.6 task-26.2 row)*
- **AC-4** Given an invitation older than 7 days, then it is refused with 410 `invitation-not-acceptable`, its `standing` reading expired. *(source: FR text; §12.5.6 task-26.2 row)*
- **AC-5** Given a revoked invitation, then it is refused immediately with 410 `invitation-not-acceptable`, its `standing` reading revoked. *(source: BR-ACC-2; FR-57)*
- **AC-6** Given a token that matches no invitation, then it is refused with 410 `invitation-not-acceptable`, its `standing` reading unknown. *(source: §12.5.6 task-26.2 row)*
- **AC-7** Given the invited address is already an active member, then the invitation is consumed, the role is unchanged and the call succeeds. *(source: §12.5.6 task-26.2 row)*
- **AC-8** Given the invited address belonged to a removed member, then the row is reactivated at the invited role. *(source: `architecture.md` §6.5; §12.5.6 task-26.2 row)*
- **AC-9** Given an organization over its ceiling, then acceptance is 409 and the invitation stays pending, so the same link works once room exists. *(source: §12.5.6 task-142 row)*
- **AC-10** Given a sixth refused attempt in the window, then 429 is answered and the invited person's own account is unaffected. *(source: §12.5.6 task-26.2 row)*
- **AC-11** Given no session, then the preview still answers and consumes nothing. *(source: §12.5.6 task-26.2 row)*

**History.**
- 25 Aug 2026 · project owner · acceptance sets the active organization; an active member's role is left untouched; a removed member is reactivated · §12.5.6 task-26.2 rows; task 25.1
- 13 Sep 2026 · project owner · acceptance is refused, and the invitation left pending, over the seat ceiling or where it cannot be read · §12.5.6 task-142 row; UC-15
- 14 Sep 2026 · project owner · a provider-registered invitee completes setup first · §12.5.6 task-155 row (5)
- 16 Sep 2026 · project owner · S-03's remedies fit the reader · §12.5.6 task-114 row

### FR-12 — Several memberships, one active organization

**Status.** Built — delivered 25.1, 25.3, 25.4, 26.2, 29.1, 30.1, 30.5, 83, 112, 130

**Obligation.** The system shall support multiple organization memberships per account with an active-organization selection that scopes all subsequent data access, permissions and screens.

| | |
|---|---|
| **Actors** | CA. |
| **Traces** | UC-16 · UX-2, UX-3, UX-136 · NFR-9 · `architecture.md` AD-2, AD-12, §6.5 and §12.5.6's task-83 row · entity *Membership* |
| **Surfaces** | The global tier's organization switcher · S-05 · S-35 · S-37 · `GET /memberships` (200 · 401) · `PUT /session/organization` (204 · 401 · 404) |

**Preconditions.** The user holds at least one membership (UC-16).

**Behaviour.**
1. The active organization is a column on the session record, resolved server-side on every request. It is never a claim in the token, a path segment or client state (UX-2; §6.5; §9.1).
2. The rule that chooses it is one pure function: a preference that still names an active membership wins; with no preference, exactly one membership is selected; several with no choice select none; a stale preference degrades to none and never to the first membership (`select-active-membership`, task 25.3).
3. §4.3's branch after sign-in sends an account with no membership to S-04, one to S-05, and several to S-05 where the session names one it still holds and to S-37 otherwise. A failed membership read is S-35. S-37 is met wherever that state is met, including a stale choice left by a removal (FR-59; task-83 row (3)).
4. The switch is `PUT /session/organization`. The chosen organization is set only where the account holds an **active** membership in it; one never held, one held as removed and an id naming nothing are one refusal, 404, so the answer does not say which organization ids exist. Nothing is reissued, since the token names the session and nothing else (task-83 row).
5. A switch lands on the equivalent screen: an account screen stays; a section's own screen stays where the new role may open it; a record's screen goes to its section's screen; anything else goes to S-05. Whether the role opens it is the api's answer after the switch (UX-3; task-83 row (1)).
6. A switch with unsent changes flushes them first, and asks with a chance to cancel where they cannot go (UX-3; UX-37; task-83 row).
7. Membership rows are readable under two policies — the bound organization's members, and the account's own where no organization is bound — so the lookup that produces the tenant can run before one exists. While an organization is bound, only its memberships are readable (`architecture.md` §7.6, tasks 25.1 and 130).

**Refusals.**
- Organization not held, removed, or unknown → 404 `not-found` (`identity.membership.membership_not_held`)
- No session → 401 `authentication-required`

**Effects.** `identity.session.active_organization_id` is written by an invitation's acceptance, an organization's founding and the switch (§6.5).

**Boundaries.** Creating an organization is FR-13. The workspace tier's locked sections are drawn from the role, and admit nothing (UX-3 as scoped by task 173).

**Acceptance criteria.**
- **AC-1** Given two memberships, when the active organization is switched, then the data, permissions and screens in scope are those of the selected organization only. *(source: FR text; UC-16)*
- **AC-2** Given exactly one membership and no preference, then it is the active organization with no choice asked. *(source: `select-active-membership`; UC-16)*
- **AC-3** Given several memberships and no choice, then no organization is active, and S-37 asks. *(source: UX-2; §12.5.6 task-83 row (3))*
- **AC-4** Given a preference naming an organization the account was removed from, then it degrades to no choice and never to another organization silently. *(source: task 25.3)*
- **AC-5** Given a switch to an organization the account does not hold, then 404 is answered and the session is unchanged. *(source: §12.5.6 task-83 row)*
- **AC-6** Given unsent changes, when the organization is switched, then they are sent first, or a dialogue offers to cancel. *(source: UX-3; §12.5.6 task-83 row)*
- **AC-7** Given a request bound to one organization by a member of two, then only the bound organization's memberships are visible to it. *(source: `architecture.md` §7.6; task 130)*

**History.**
- 25 Aug 2026 · project owner · the active organization is a column on the session; the selection rule is a pure function; the memberships policy has a second reader · `architecture.md` §6.5, §7.6; tasks 25.1, 25.3
- 11 Sep 2026 · build · the second policy applies only while no organization is bound · task 130 row
- 15 Sep 2026 · project owner · the switch route, UX-3's equivalent screen and S-37 · §12.5.6 task-83 row

## 3. Users and access (index §3.12)

### FR-56 — Who has access

**Status.** Built — delivered 25.1, 25.2, 26.1, 26.4, 130, 131, 139, 140, 142, 199 (the guard's recording of last activity, appended after the fact)

**Obligation.** The system shall list every user with access to the organization, their role, status — active or pending invitation — and last activity.

| | |
|---|---|
| **Actors** | OA alone. |
| **Traces** | UC-59 · UX-137, UX-50 · `architecture.md` §6.5 and §12.5.6's task-131, task-142 and *A member's last activity* rows · entity *Membership* |
| **Surfaces** | S-16 (Index) · `GET /access` (200 · 403) · `GET /members` · `GET /invitations` · `GET /access/seats` |

**Behaviour.**
1. The list is one union across two tables: active memberships and pending invitations. The filter, the order and the page are applied to the merged set on the server (task-131 row).
2. Each row carries its kind, its role (for an invitation, the role it grants), a **standing** — `active`, `invited` or `invitation_expired` — and a derived display name. A lapsed invitation is listed with its own standing, since it holds a seat (task-142 row (2)).
3. Filters are role and standing. The default order is last activity, newest first; role and standing order by rank, not alphabetically, and the address breaks every tie. The total counts rows surviving the filter and `unfiltered` counts them before it. A request for all rows at once is refused (task-131 row).
4. The standing is derived from the clock in the statement that filters and orders on it, so a row cannot be admitted as live and drawn as expired (task-131 row).
5. **Last activity** is recorded by the guard: once it has resolved the active membership and passed every refusal, it writes the request's instant to that member's row unless what is recorded is within five minutes of it, in its own short transaction. Any signed-in request in that organization counts, a poll included; a request acting for no organization, and a refused one, record nothing (§12.5.6, *A member's last activity*). A member who has never been active shows as not signed in yet.
6. The person's name is the derived display name (UX-137), derived a second time in SQL so the sorted value is the rendered value (task-140 row).
7. Removed members are not listed (`design_spec.md` S-16, the prototype's *Restore* declined).

**Refusals.** Not OA → 403 `insufficient-role`; no active membership → 403 `membership-required`; all rows requested → 400.

**Boundaries.** Seat counts are FR-57's. Changing a role is FR-58, removal FR-59, promotion FR-60.

**Acceptance criteria.**
- **AC-1** Given an organization with members and pending invitations, then each appears once with role, standing and, for a member, last activity. *(source: FR text; UC-59)*
- **AC-2** Given a filter on role or standing, then the filter, the page counts and the order apply to the merged list and not to one table. *(source: §12.5.6 task-131 row)*
- **AC-3** Given a member whose request was recorded within five minutes, then their last activity does not move; given one outside five minutes, it moves. *(source: §12.5.6 *A member's last activity* row)*
- **AC-4** Given a member who has never made a request, then their last activity is absent and the screen says they have not signed in yet. *(source: §12.5.6 *A member's last activity* row)*
- **AC-5** Given an editor or a view-only member, then the list is refused with 403. *(source: `actors.md` §5)*
- **AC-6** Given a lapsed invitation, then it is listed with standing `invitation_expired`. *(source: §12.5.6 task-142 row (2))*

**History.**
- 25 Aug 2026 · project owner · the list is a union across two tables · task 25.1 row; `design_spec.md` S-16
- 11 Sep 2026 · project owner · filter, sort and page are server side · task 131 row
- 12 Sep 2026 · project owner · the person column is the derived name · task 139, 140 rows
- 28 Sep 2026 · project owner · the guard records last activity at a five-minute grain · §12.5.6 *A member's last activity* row
- 5 Oct 2026 · project owner · the recording is cited to a closed row appended after the fact, as task 130 was, and not to task 28 · §12.5.6 task-182 tracking row (182/157)

### FR-57 — Invite, resend and revoke

**Status.** Partial — delivered 26.1, 26.4, 141, 142 · remaining 54.2 (the ceiling becomes the plan's seat entitlement, with the upgrade path in its gate)

**Obligation.** The system shall allow a user to be invited by email with an edit or view-only role, an unacted invitation to be resent, and an invitation to be revoked, with revocation invalidating the outstanding link immediately.

| | |
|---|---|
| **Actors** | OA alone. The invitee acts through FR-11. |
| **Traces** | UC-60, UC-61 · UC-148, UC-150 (the quota path) · BR-ACC-2 · UX-50, UX-52 · `architecture.md` AD-5, OQ-30 and §12.5.6's task-26.1, task-141, task-142 rows · NFR-64, NFR-79 · entity *Invitation* |
| **Surfaces** | S-16 (the invitation dialogue, `?panel=invite`; the seat region; the gate) · `GET /invitations` · `POST /invitations` (201 · 400 · 409 · 429 · 503) · `POST /invitations/{id}/email` (204 · 404 · 429) · `DELETE /invitations/{id}` (204 · 404) · `GET /access/seats` |

**Inputs.** An address and a role, `editor` or `viewer`. Organization Administrator is not invitable: it is granted to an existing member (FR-60).

**Behaviour.**
1. Issue creates a single-use invitation bound to the address and emails it through the outbox (category `identity.invitation`). The link lasts 7 days.
2. A resend rotates the token and restarts the 7 days on the same row, so the invitation keeps its identity, role and history. There is exactly one live link per invitation, and the previous one is dead at once. A lapsed invitation can be resent (task-26.1 rows).
3. Revoke withdraws the invitation. The link is dead immediately, the record is kept, and the address is free to be invited again, usually at another role (UC-61).
4. An address held by an **active member** is refused with 409 `already-member`; one holding a **pending invitation**, lapsed included, with 409 `invitation-outstanding`. A partial unique index on (organization, lower(address)) where pending makes it the database's rule. A duplicate is never a silent resend (task-26.1 rows).
5. The invitation email is written in the invited address's account email language where one exists, and in the inviting administrator's negotiated locale otherwise, resolved once at issue and stored (task-26.1 rows; task 52.3).
6. Issue and resend draw on **one** allowance: 5 mails per 15 minutes to one address from one organization. A refusal costs nothing and a refused issue rolls its own attempt back. The key is (organization, address) with no IP, because the caller is a named administrator and what is rationed is a mailbox (task-141 row).
7. A **seat ceiling** is counted over active members plus pending invitations, lapsed ones included. It is enforced at issue and at membership creation. The check follows the insert, so an address already outstanding is still refused as the collision it is, and a transaction-scoped advisory lock per organization keeps two invitations at the last seat from both committing. An absent or malformed ceiling refuses with 503 and S-16 says invitations are paused (task-142 row).
8. At the ceiling the invitation form is not offered; the dialogue carries the gate in its place, naming revoking an invitation or removing someone as the way out. One seat left shows the approaching-limit warning against the counter (`design_spec.md` S-16; UX-52).

**Refusals.**
- Malformed address, or a role not invitable → 400 `validation-failed`
- Address already an active member → 409 `already-member`
- Invitation already outstanding → 409 `invitation-outstanding`
- Ceiling reached → 409 `entitlement-quota-exceeded`, carrying `limit` and `used`
- Ceiling unreadable → 503 `seat-allowance-unavailable`
- Mail budget spent → 429 `rate-limited`
- Invitation not outstanding (accepted or revoked) → 404 `not-found`
- Not OA → 403 `insufficient-role`

**Effects.** One `invitation` row per invitation, an outbox event per mail, and a field-change row for each issue and resend.

**Configuration-held values.** `seat-allowance.global.json`: `seats` 10, an interim operational bound and not the Free plan's cap, which stays a commercial decision (`use_cases.md` OQ-8). One `global` scope, no per-organization override. Task 54.2 deletes the artefact (§12.5.6 task-142 row).

**Boundaries.** Accepting is FR-11. The Free plan's cap on users and the upgrade path of the gate are FR-102's, with the upgrade path deferred until a plan exists (§12.5.6 task-142 row (b)). The seat meter on S-17 counts differently and is reconciled by 54.2.

**Acceptance criteria.**
- **AC-1** Given an address that is not a member or invited, when an invitation is issued with role editor or viewer, then it is created, a mail is queued and the invitation appears on S-16. *(source: FR text; UC-60)*
- **AC-2** Given an unacted invitation, when it is resent, then the same invitation holds a new link valid 7 days, and the old link is refused. *(source: FR text; §12.5.6 task-26.1 row)*
- **AC-3** Given a revoked invitation, then its link is refused immediately and the address may be invited again. *(source: FR text; BR-ACC-2; UC-61)*
- **AC-4** Given an active member's address, then issue is refused with 409 `already-member`. Given a pending invitation, lapsed included, then 409 `invitation-outstanding`. *(source: §12.5.6 task-26.1 row)*
- **AC-5** Given a role of organization_administrator, then issue is refused with 400. *(source: `design_spec.md` S-16; UC-64)*
- **AC-6** Given a 6th issue or resend to one address from one organization in 15 minutes, then 429 is answered, and another organization inviting that address is unaffected. *(source: §12.5.6 task-141 row)*
- **AC-7** Given members plus pending invitations at the ceiling, then issue is 409 with `limit` and `used`, and a lapsed invitation counts. *(source: §12.5.6 task-142 row)*
- **AC-8** Given an absent or malformed ceiling, then issue is 503 and S-16 says invitations are paused. *(source: §12.5.6 task-142 row (3))*
- **AC-9** Given a plan seat entitlement, then the ceiling is that entitlement and the gate offers the upgrade path. *(source: UX-50; FR-102)* Unmet until 54.2.

**History.**
- 25 Aug 2026 · project owner · a resend rotates the token; the email language; both collisions refused with their resolving action · §12.5.6 task-26.1 rows
- 12–13 Sep 2026 · project owner · the mail throttle, keyed (organization, address) over both routes · §12.5.6 task-141 row; FR-57's index note
- 12–13 Sep 2026 · project owner · the seat ceiling as configuration, a lapsed invitation holds a seat, fail closed · §12.5.6 task-142 row

### FR-58 — Change a member's role

**Status.** Built — delivered 25.1, 25.2, 26.4, 28.1

**Obligation.** The system shall allow an existing member's role to be changed, taking effect on that user's next request rather than at their next login.

| | |
|---|---|
| **Actors** | OA alone. |
| **Traces** | UC-62 · BR-ACC-3 · `architecture.md` AD-12, AD-15, §6.2 · NFR-62 · entity *Membership* |
| **Surfaces** | S-16 (row action) · `PATCH /members/{membershipId}` (204 · 404 · 409) |

**Preconditions.** The target is an existing, active member (UC-62).

**Inputs.** The role: `editor`, `viewer` or `organization_administrator`. Setting the role already held is permitted and changes nothing.

**Behaviour.**
1. The role is read from the membership row on every request and never carried in the token (AD-12), so a demotion binds on the member's next request with the token they already hold. Nothing is cached, so nothing needs invalidating (§6.2; use-case note).
2. One operation serves UC-62 and UC-64, and the single-administrator rule applies where an administrator is demoted (FR-60).
3. A removed member is not a member; re-granting access is an invitation (use-case note; FR-11).
4. Each change enters the field-change trail (FR-55; task 25.1).

**Refusals.** Not an active member of this organization → 404 `not-found` · would leave no Organization Administrator → 409 `last-administrator` · role not in the vocabulary → 400 `validation-failed` · not OA → 403.

**Boundaries.** Promotion to administrator is FR-60. Hints to a signed-in browser are AD-15's and never the authority.

**Acceptance criteria.**
- **AC-1** Given a member changed from editor to viewer, then their next request is evaluated as viewer with no re-authentication. *(source: FR text; UC-62; AD-12)*
- **AC-2** Given a role change, then the change appears in the field-change trail. *(source: §12.5.6 task-25.1 row, FR-55)*
- **AC-3** Given a removed member's membership id, then the change is refused with 404. *(source: use-case note)*
- **AC-4** Given an editor, then the call is refused with 403. *(source: `actors.md` §5)*

**History.**
- 25 Aug 2026 · project owner · the role is read per request, so a change binds on the next one · `architecture.md` §6.2 (task 28.1); task 25.2 row

### FR-59 — Remove a member's access

**Status.** Built — delivered 25.1, 25.2, 26.4, 83

**Obligation.** The system shall allow a member's access to the organization to be removed without deleting their account or their historical contributions.

| | |
|---|---|
| **Actors** | OA alone. |
| **Traces** | UC-63 · FR-55 · BR-ACC-4 · UX-69, UX-70 · `architecture.md` §6.5 · entity *Membership* |
| **Surfaces** | S-16 (row action, a consequence dialogue naming the person) · `DELETE /members/{membershipId}` (204 · 404 · 409) |

**Preconditions.** The target is a member (UC-63).

**Behaviour.**
1. Removal is a status change and never a delete, and no runtime role holds `DELETE` on the membership table. The membership's own history — when the role was granted, by whom, and when access was withdrawn — is kept, and the row leaves only with its account or organization (§6.5).
2. A removed member's contributions stay attributed: `core.field_change` carries `actor_id` with no foreign key, so it survives (FR-55; §6.5).
3. Their sessions are not ended. Their next request in that organization is refused, and they keep any other organization they belong to (`DELETE /members/{id}` description).
4. An active-organization choice naming the organization degrades to none: with several memberships the account is asked to choose (FR-12; task-83 row (3)).
5. S-16 states at the point of removal that historical contributions stay attributed, naming the specific user (UX-69, UX-70).
6. Re-granting access later is a new invitation, which reactivates the row (FR-11).
7. The single-administrator rule applies to the last administrator (FR-60).

**Refusals.** Not an active member → 404 · would leave no Organization Administrator → 409 `last-administrator` · not OA → 403.

**Acceptance criteria.**
- **AC-1** Given a removed member, then their next request in that organization is refused. *(source: FR text; UC-63)*
- **AC-2** Given a removed member, then their account still exists and their attributed history is unchanged. *(source: FR text; BR-ACC-4)*
- **AC-3** Given a removed member who belongs to another organization, then their access there is unchanged. *(source: `DELETE /members/{id}` description)*
- **AC-4** Given a removal, then the dialogue names the person and states that their history stays attributed. *(source: UX-69, UX-70)*
- **AC-5** Given the membership row, then no runtime role can delete it. *(source: `architecture.md` §6.5; P-4)*

**History.**
- 25 Aug 2026 · project owner · removal is a status change, and the table is not deletable by the runtime roles · `architecture.md` §6.5 (task 25.1)

### FR-60 — Promote to Organization Administrator

**Status.** Built — delivered 25.2, 26.4, 130

**Obligation.** The system shall allow another member to be promoted to Organization Administrator, so that the departure of a sole administrator cannot lock an organization out of its own settings.

| | |
|---|---|
| **Actors** | OA alone. |
| **Traces** | UC-64 · UC-62, UC-63 · D-1 · `architecture.md` §6.5, §7.6 and the task-130 row · entity *Membership* |
| **Surfaces** | S-16 (promote) · `PATCH /members/{membershipId}` with `organization_administrator` (204 · 404 · 409) |

**Preconditions.** The target is a member (UC-64).

**Behaviour.**
1. Promotion is FR-58's operation with the role fixed. The rule that gives it purpose is the guard on the two paths that take an administrator away, demotion and removal: a change is refused when it would leave the organization with no Organization Administrator (`wouldLeaveNoAdministrator`, task 25.2).
2. The count is administrators who still hold access, read inside the request transaction and **in the bound organization only**. A role held in another organization does not count (task 130).

**Refusals.** Would leave none → 409 `last-administrator` · not an active member → 404 · not OA → 403.

**Acceptance criteria.**
- **AC-1** Given an administrator promoting a member, then that member holds administrator rights over the organization from their next request. *(source: FR text; UC-64)*
- **AC-2** Given the only administrator, when they demote themselves or are removed, then 409 is answered and nothing changes. *(source: FR text; §12.5.6 task-25.2 row)*
- **AC-3** Given two administrators, then one may be demoted or removed. *(source: FR text)*
- **AC-4** Given an account that administers two organizations and acts for one, then demoting itself in that one is refused unless another administrator exists there. *(source: task 130 row)*

**History.**
- 25 Aug 2026 · project owner · demotion and removal carry the same rule as one predicate · task 25.2 row
- 11 Sep 2026 · build · the count is of the bound organization only; a live bypass closed · task 130 row

## 4. Business rules held in this part

Moved from the index's §4.2 on 5 Oct 2026 (task 182), with their identifiers unchanged. A rule is not an additional requirement: it is a rule carried inside the requirement(s) it names, gathered here so the decision logic can be read in one place. Where a rule and its requirement differ, the requirement is the authority.

| Rule | Statement | Held in |
|---|---|---|
| BR-ID-1 | No application data is reachable until email verification completes; a provider-asserted verified address satisfies verification. *Amended 25 Aug 2026 (task 26.2): so does a registration from a live invitation for that same address. Amended 14 Sep 2026 (task 155): for an account registered through a provider, satisfied verification enters setup, not the active state, until a password and both name parts are set.* | FR-1, FR-2, FR-3 |
| BR-ID-2 | A provider identity is matched on its subject identifier, never on its email address. | FR-4 |
| BR-ID-3 | A provider assertion alone never attaches to an existing account; the user must first authenticate with an existing credential. | FR-2, FR-8 |
| BR-ID-4 | The last remaining credential on an account cannot be removed. | FR-8 |
| BR-ID-5 | A password reset endpoint returns an identical response for registered and unregistered addresses; consuming a reset link invalidates all sessions. | FR-6 |
| BR-ACC-2 | An invitation is bound to the invited email address, is single-use, and expires; revocation invalidates the outstanding link immediately. | FR-11, FR-57 |
| BR-ACC-3 | A role change takes effect on the user's next request, not at their next login. | FR-58 |
| BR-ACC-4 | Removing a member's access deletes neither their account nor their attributed history. | FR-59, FR-55 |

## 5. Entities held in this part

Moved from the index's §5.1 on 5 Oct 2026 (task 182). These rows list the attributes the requirements name. They are not a data model.

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Account | Credential(s) held (a password, provider identities), status (`unverified`, `awaiting_setup`, `active`), verification link (single-use, 24 h), expiry of an unverified or abandoned-in-setup account (7 days from registration; none for one moved into setup from active), lockout state (10 consecutive failures), given and family name (the display name derived, not stored) | FR-1, FR-2, FR-3, FR-4, FR-6, FR-9 |
| Provider identity | Provider, subject identifier, asserted email, asserted-verified flag; at most one account per (provider, subject) | FR-2, FR-4, FR-8 |
| Session | Scope over organization memberships and roles (role and organization read per request, never carried in the token), active organization, remembered or not (idle and absolute lifetimes), rotating single-use refresh token, server-side termination with a recorded reason | FR-4, FR-5, FR-6, FR-7, FR-12 |
| Password reset token | Single-use, time-limited (60 min); for an account's first password, a grant of the same kind with a 15-minute life, claimed only by its own route | FR-6, FR-2, FR-3 |
| User profile | Given and family name (the display name derived, not stored), contact email (the sign-in address), optional job title and phone number, notification preferences, interface language, email language, export-default language | FR-9, FR-10, FR-52, FR-163, FR-169 |
| Membership | User, organization, role (edit / view-only / Organization Administrator), status (active, removed), last activity, when the role was granted and access withdrawn; one row per (account, organization), retained on removal | FR-11, FR-12, FR-56, FR-58, FR-59, FR-60 |
| Invitation | Invited email, assigned role (edit or view-only), single-use, expiry (7 days, restarted by a resend), revocation state, the language its email was written in; at most one pending per (organization, address) | FR-11, FR-57 |
