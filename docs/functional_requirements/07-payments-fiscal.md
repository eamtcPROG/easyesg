# Functional requirements — Part 7: Payment, invoicing, reconciliation, collections and financial reporting

Part 7 of the eleven parts of [`functional_requirements.md`](../functional_requirements.md). The index and its parts are **one document**, with one authority and one `FR-n` sequence. The block shape, the sourcing rule for acceptance criteria and the status vocabulary are set in the index (§2.5, §2.7, §2.8).

| Index § | Requirements |
|---|---|
| 3.22 Payment | FR-114 … FR-120 |
| 3.23 Invoicing | FR-121 … FR-130 |
| 3.24 Reconciliation | FR-131 … FR-134 |
| 3.25 Collections | FR-135 … FR-138 |
| 3.26 Refunds and disputes | FR-139 … FR-141 |
| 3.27 Enterprise | FR-142 … FR-147 |
| 3.28 Financial reporting | FR-148 … FR-152 |

Business rules held here: BR-PAY-1 … BR-PAY-7, BR-INV-1 … BR-INV-8, BR-COL-1 … BR-COL-6, BR-LED-1 (§4). Entities held here: §5.

**Where this part stands.** Nothing in it is built. `apps/api/src/modules/billing/*` holds thirteen empty module stubs, the `billing` schema exists with no tables, `packages/contracts` has no path in this area and `config/seed` has no artefact for it. Every block therefore reads **Not started**, no Refusal below has a built wire outcome (index §2.7 rule 4), and no acceptance criterion is met; the Status line names the tasks that will meet it, so the "Unmet until" suffix is not repeated on each criterion. The tasks are mostly 55 … 66, 68 and 70 in `docs/task.md` (with 71.2 and 73.3 for the archive), all `TODO`.

**Standing facts that bind every block.**
- Billing is a separate bounded context from the compliance core (D-11, DR-1): `modules/billing/*` over schema `billing`, with the ledger in `audit` (`architecture.md` §7.10). With `BILLING_ENABLED=false` none of this part is reachable and UC-17 … UC-48 still pass (NFR-1).
- Money is held as integer minor units and rounded at issuance, half-up, per line and then summed (`architecture.md` §7.8; NFR-58). MDL is the ledger currency (D-14).
- A date that carries legal force (invoice date, fiscal year, rate date, VAT effective date) is a calendar date plus the timezone that determines it, never an instant (NFR-34; `architecture.md` §6.8).
- The national e-Factura mandate for B2B invoicing takes effect on 1 Oct 2026 and binds from the first paid invoice (D-9; `architecture.md` §15.4's first scheduling fact).
- Actors: **OA** is the Organization Administrator (the tenant side, in `apps/web`); **BO** is the Billing Operator (the console, in `apps/admin`); **SYS** is the platform acting on a schedule or an event (`actors.md` §5).
- A point no source decided was settled by the owner on 5 Oct 2026; each block cites the §12.5.6 task-182 row that records it.

## 1. Payment (index §3.22)

### FR-114 — Money moves through licensed third parties, behind one adapter

**Status.** Not started — remaining 59.1, 59.2, 60.1, 60.2, 60.3, 63.4

**Obligation.** The system shall perform all money movement through licensed third parties reached behind a single provider adapter interface, with rail-agnostic order routing and the customer choosing at checkout, and shall register the merchant-of-record adapter inactive at MVP so that activation is configuration.

| | |
|---|---|
| **Actors** | OA chooses a rail at checkout. SYS routes the order and receives the provider's result. No Billing Operator or Platform Administrator moves money. |
| **Traces** | UC-116, UC-120, UC-121, UC-122 · D-7, D-8 · DR-7, DR-9 · AD-6, AD-8 · NFR-11, NFR-14, NFR-50, NFR-54, NFR-74 · BR-PAY-1 · entity *Payment* |
| **Surfaces** | S-20 (hand-off and return) · S-19 (the choice of rail; FR-110) · provider callbacks under `/api/v1/webhooks/*` |

**Behaviour.**
1. Four rails sit behind ports: domestic card acquiring (maib primary, Victoriabank and MICB), MIA through the participating banks' APIs, bank transfer against a proforma (no provider call), and a merchant of record, registered and inactive (`architecture.md` AD-8 port table; D-8).
2. Routing is rail-agnostic. Adding or replacing a rail changes an adapter implementation and routing configuration, and nothing else (NFR-14). The provider registry is read from configuration (AD-8).
3. The platform holds no customer funds and has no custody or settlement code path (NFR-74; DR-7).
4. The merchant-of-record adapter is registered and inactive; activation is configuration (D-8; UC-122). Its screen arrives when the rail is activated, not before (task 60.3; UX-7).
5. A provider outage is confined to the affected path: the operation is queued or an alternative rail is offered, and no acknowledged customer action is lost (NFR-50).
6. A provider callback carries a signature rather than a session, is de-duplicated on `(provider, provider_event_id)`, and is the only authority for order state (`architecture.md` OQ-29; AD-6; §11.2).

**Boundaries.** Rail availability by order total, and the reason shown for an excluded rail, are FR-110's. Card is FR-116, MIA FR-118, transfer FR-119, recurring charges FR-120.

**Acceptance criteria.**
- **AC-1** Given any order, then no money movement occurs outside a provider adapter. *(source: FR text; NFR-74)*
- **AC-2** Given a registered rail, then the order flow routes to it with no rail-specific order logic. *(source: FR text; NFR-14)*
- **AC-3** Given the merchant-of-record adapter, then it is registered and inactive, and activating it is a configuration change with the diff limited to the adapter and routing configuration. *(source: FR text; D-8; NFR-14)*
- **AC-4** Given a rail's provider is unavailable, then the operation is queued or an alternative rail is offered, and no acknowledged customer action is lost. *(source: NFR-50)*
- **AC-5** Given the same provider event delivered twice, then one effect results. *(source: AD-6; NFR-54)*

**History.**
- 18 Aug 2026 · architecture OQ-29 closed · provider webhooks get their own 600 requests per minute bucket per source address at the edge; correctness rests on signature verification and `(provider, provider_event_id)` de-duplication · `architecture.md` §12.5.6's rate-limit table and OQ-29

### FR-115 — No card data reaches the platform

**Status.** Not started — remaining 59.1, 59.2, 63.4

**Obligation.** The system shall receive, store and transmit no card data at any point, retaining only the acquirer's transaction reference and a masked descriptor.

| | |
|---|---|
| **Actors** | OA pays at the acquirer. SYS stores the result. |
| **Traces** | UC-116 · D-7 · DR-7 · NFR-60 · UX-57 · BR-PAY-2 · entity *Payment* |
| **Surfaces** | S-20 · S-21 (instruments shown as masked descriptors only) |

**Behaviour.**
1. Card capture happens on the acquirer's hosted page or SDK. The platform's scope is PCI DSS SAQ-A (NFR-60; DR-7).
2. No card field exists anywhere in the product, and the platform never imitates a payment form (UX-57; S-20).
3. What the platform keeps from a card payment is the acquirer's transaction reference and a masked descriptor (UC-116 step 3).

**Acceptance criteria.**
- **AC-1** Given the whole system, then no component receives, stores or transmits card data. A prohibition: verified by showing the state is unreachable. *(source: FR text; NFR-60)*
- **AC-2** Given a payment record, then it holds the acquirer transaction reference and a masked descriptor and nothing else of the card. *(source: FR text; UC-116 step 3)*
- **AC-3** Given any screen in the product, then none carries a card-number field. *(source: UX-57; NFR-60)*

### FR-116 — Pay by domestic card, 3-D Secure included

**Status.** Not started — remaining 59.2, 59.3, 63.4

**Obligation.** The system shall accept domestic card payment through the acquirer's hosted page or SDK including the 3-D Secure challenge, with the order surviving the round trip and possible mid-challenge abandonment without duplicating the charge or the order.

| | |
|---|---|
| **Actors** | OA pays. SYS records the result. |
| **Traces** | UC-116, UC-117 · D-8 · UX-58 · AD-6 · NFR-54 · `architecture.md` §11.2, OQ-36 · FR-115 · entity *Payment* |
| **Surfaces** | S-20 (all four returns) · `GET /orders/{id}` (polled while awaiting payment; §11.2) · the acquirer callback under `/api/v1/webhooks/*` |

**Preconditions.** A confirmed order and a card rail available for the order total (UC-116).

**Behaviour.**
1. The platform redirects to the acquirer's own page or SDK; the Administrator pays there and the platform receives the result (UC-116 steps 1 … 3).
2. When the issuer requires strong authentication, the Administrator completes it and returns with the authentication result carried on the transaction (UC-117).
3. **Order state is authoritative from the server-to-server callback only.** The browser return triggers a poll and nothing else; a return that arrives before the callback shows *confirming payment* and does not fail the order (§11.2). The poll runs every 3 s, only while the order is awaiting payment, and stops when it settles (OQ-36).
4. The return is designed for four outcomes: success, failure, cancellation and abandonment mid-challenge. An indeterminate return shows *pending* with what happens next and when, not an error (UX-58).
5. A confirmed callback moves the saga from awaiting payment to paid, then on to invoiced and provisioned (AD-6; FR-122).

**Boundaries.** How long an order may wait before it expires is FR-108's and FR-112's.

**Acceptance criteria.**
- **AC-1** Given a confirmed order, when the Administrator pays at the acquirer, then the payment completes and the platform stores only the transaction reference and masked descriptor. *(source: FR text; UC-116)*
- **AC-2** Given a payment abandoned mid-challenge, then exactly one order exists and no duplicate charge was made. *(source: FR text; UC-117 exception flow)*
- **AC-3** Given a 3-D Secure challenge, then the authentication result is carried on the transaction. *(source: FR text; UC-117 step 2)*
- **AC-4** Given the browser returns before the callback, then the screen reads *confirming payment* and the order is not failed. *(source: §11.2; UX-58)*
- **AC-5** Given the callback is delivered twice, then one payment and one invoice result. *(source: AD-6; NFR-54)*

### FR-117 — Stored cards for recurring billing, under separate consent

**Status.** Not started — remaining 59.4 (token storage, the consent record, instrument management), 63.5

**Obligation.** The system shall store a card token for recurring billing under a consent recorded separately from the payment itself, and shall allow stored instruments to be viewed, replaced, removed and defaulted, warning that renewal will fail when the last instrument on an auto-renewing subscription is removed.

| | |
|---|---|
| **Actors** | OA gives consent and manages instruments. |
| **Traces** | UC-118, UC-119 · D-8 · UX-60, UX-70 · FR-115, FR-120 · BR-PAY-5 · entity *Stored payment instrument* |
| **Surfaces** | S-21 (Index: stored instruments with masked descriptor, default, consent state; add, replace, remove, set default) · S-20 (adding goes through the provider) |

**Preconditions.** A card payment through the acquirer (UC-118). At least one stored instrument, to manage (UC-119).

**Behaviour.**
1. Consent is an explicit act, recorded as its own record and separate from the payment, and worded as a recurring authorisation (UC-118; UX-60). *An authorisation to charge once and an authorisation to charge every month are different permissions* (UC-118).
2. The token is the acquirer's; the platform holds a reference to it, the masked descriptor, the consent record and a default flag (entity *Stored payment instrument*; FR-115).
3. The Administrator sees which instrument is the default for renewal (UC-119 step 2).
4. Removing the last instrument on an auto-renewing subscription is a consequence-disclosing action: it warns that renewal will fail rather than leaving the organization to find out at suspension (UC-119; S-21; UX-70).
5. **Consent belongs to the instrument and goes with it** (182/82). A card is stored only with its recurring consent, so no token exists without one. *Replace* is add-with-new-consent and then remove: the replacement carries a consent given for it as its own explicit act, and the old instrument's consent ends with the old instrument. Removing an instrument withdraws the consent it carries, and a replacement never inherits it. Storing a card is a choice made when paying; whether the subscription is set to renew is its own state (FR-97) and is not a precondition of storing.

**Acceptance criteria.**
- **AC-1** Given a card payment, when the Administrator consents to recurring billing, then the consent is stored as a record separate from the payment, with the acquirer's token. *(source: FR text; UC-118)*
- **AC-2** Given stored instruments, then they can be listed, replaced, removed and set as default. *(source: FR text; UC-119)*
- **AC-3** Given the last instrument on an auto-renewing subscription, when removal is requested, then a warning names that renewal will fail. *(source: FR text; UC-119; S-21)*
- **AC-4** Given the instruments screen, then each is shown as a masked descriptor only. *(source: S-21; FR-115)*
- **AC-5** Given a replaced instrument, then the new instrument carries a consent given for it, the old instrument and its consent end together, and nothing is inherited. *(source: §12.5.6 task-182 payment and fiscal row, 182/82)*
- **AC-6** Given an instrument that is removed, then the consent it carried no longer authorises any charge. *(source: §12.5.6 task-182 payment and fiscal row, 182/82)*

**History.**
- 5 Oct 2026 · project owner · consent is a field of the instrument; replace is add-with-new-consent then remove · §12.5.6 task-182 payment and fiscal row (182/82)

### FR-118 — MIA instant payment within the ceiling

**Status.** Not started — remaining 60.1, 63.4, 194 (the ceiling artefact)

**Obligation.** The system shall offer MIA instant payment by QR, payment link or request-to-pay only where the order total is within the per-transaction ceiling, reading the applicable limit from configuration rather than code.

| | |
|---|---|
| **Actors** | OA pays from their own bank. SYS applies the ceiling. |
| **Traces** | UC-120 · D-8 · NFR-73 · UX-56 · FR-110 · BR-PAY-3 · `use_cases.md` OQ-7 |
| **Surfaces** | S-19 (the rail shown, or shown unavailable with its reason) · S-20 |

**Preconditions.** The order total is within the per-transaction ceiling (UC-120).

**Behaviour.**
1. The Administrator pays by QR code, payment link or request-to-pay against their own bank; settlement is confirmed within seconds and the order is provisioned immediately (UC-120 steps 1 … 3).
2. MIA is offered where the total is at or below the ceiling (`architecture.md` AD-8 port table: *order total ≤ configured per-transaction ceiling*). Above it, the option is shown unavailable **with the reason**, never omitted (UX-56; FR-110; BR-PAY-7).
3. The ceiling is effective-dated configuration and changes with no deployment (NFR-73; AD-4's table row *MIA per-transaction and cumulative ceilings*).
4. **The amount compared is the order's gross total, VAT included, in MDL** (182/96). Only the per-transaction ceiling is enforced. The cumulative daily figure is held as configuration data and is not enforced, because the daily limit is the payer's own bank's and the platform cannot observe it (NFR-73).

**Configuration-held values.** The sources record the ceiling at about 5,000 MDL per transaction, commission-free below 10,000 MDL a month, with a recommended daily cumulative limit near 25,000 MDL (`use_cases.md` §6.2; BR-PAY-3). These are recorded values, not requirement text (index §2.5.2). The cumulative figure is held beside the per-transaction ceiling as data and is not enforced (182/96). No artefact is seeded yet (194); who owns the value is `use_cases.md` OQ-7, open.

**Acceptance criteria.**
- **AC-1** Given an order whose total is within the configured ceiling, then MIA is offered. *(source: FR text; UC-120)*
- **AC-2** Given a total above the ceiling, then MIA is shown unavailable with the reason. *(source: FR text; UX-56)*
- **AC-3** Given the ceiling is changed in configuration, then availability changes on the next order, with no deployment. *(source: FR text; NFR-73)*
- **AC-4** Given an order, then the gross total in MDL is what is compared with the per-transaction ceiling, and no cumulative figure is compared. *(source: §12.5.6 task-182 payment and fiscal row, 182/96)* Unmet until 194.

**History.**
- 5 Oct 2026 · project owner · the ceiling is compared with the gross total in MDL, per transaction only; the cumulative figure is data, not enforced · §12.5.6 task-182 payment and fiscal row (182/96)

### FR-119 — Bank transfer against a proforma

**Status.** Not started — remaining 60.2, 63.4, 65.3, 194 (the bank details)

**Obligation.** The system shall offer bank transfer against a proforma invoice carrying a unique payment reference, deferring provisioning until the payment is reconciled.

| | |
|---|---|
| **Actors** | OA settles through their own bank. BO or SYS reconciles (FR-132, FR-134). |
| **Traces** | UC-121 · D-8 · UX-59 · FR-121, FR-132, FR-134 · BR-PAY-4 · entity *Proforma invoice* |
| **Surfaces** | S-20 (the payment reference as the most prominent element) · S-22 (the proforma) |

**Preconditions.** A proforma has been issued (UC-121; FR-121).

**Behaviour.**
1. Electing transfer issues a proforma carrying a unique payment reference; the Administrator downloads it and settles through their own bank (UC-121 steps 1, 2).
2. The transfer rail calls no provider. Settlement is asynchronous and reaches the platform only through an imported statement (`architecture.md` AD-8 port table; UC-137).
3. **No entitlement is granted until the payment is reconciled**, automatically (FR-132) or manually with a reason (FR-134) (UC-121 step 3; BR-PAY-4).
4. The rail has no amount ceiling and is the default for annual and Enterprise billing (D-8).
5. The reference is the single most prominent element on the screen, copyable in one action, beside the proforma and the consequence of omitting it (UX-59).
6. **The payment reference is an opaque per-order code with a check character, unique across the platform** (182/97). It is not derived from a document number, because a proforma consumes none (FR-121), and the check character lets the matcher tell a mistyped reference from a stranger's payment (FR-133). **The proforma names the platform's own receiving bank account(s), held as effective-dated configuration** (AD-4), and prints the details in force at its issuance. How long a proforma stays valid is the order's expiry period (182/61).

**Acceptance criteria.**
- **AC-1** Given the transfer rail is elected, then a proforma with a unique payment reference is issued. *(source: FR text; UC-121 step 1)*
- **AC-2** Given a transfer order, then no entitlement is granted before reconciliation under FR-132 or FR-134. *(source: FR text; BR-PAY-4)*
- **AC-3** Given an order above the MIA ceiling, then the transfer rail is still offered. *(source: BR-PAY-4; D-8)*
- **AC-4** Given the transfer hand-off screen, then the reference is the most prominent element and is copyable in one action. *(source: UX-59)*
- **AC-5** Given two orders, then their payment references differ, and each carries a check character by which a mistyped reference is told from a valid one. *(source: §12.5.6 task-182 payment and fiscal row, 182/97)*
- **AC-6** Given the receiving account is changed in configuration, then the next proforma names the new account and every proforma already issued is unchanged. *(source: §12.5.6 task-182 payment and fiscal row, 182/97; FR-125)* Unmet until 194.

**History.**
- 5 Oct 2026 · project owner · the reference is an opaque per-order code with a check character; the bank details are configuration · §12.5.6 task-182 payment and fiscal row (182/97)

### FR-120 — Recurring charges: once per period, retried by class, failure told

**Status.** Not started — remaining 60.4, 194 (retry schedule), 60.7 (renewal of a subscription with no stored card)

**Obligation.** The system shall execute scheduled recurring charges idempotently against the renewal period, retrying soft declines on a defined schedule, never retrying hard declines, and notifying the Administrator of a failure with what failed, the consequence, the deadline and the action that fixes it.

| | |
|---|---|
| **Actors** | SYS charges, retries and notifies. OA receives the notice. |
| **Traces** | UC-123, UC-124, UC-125 · FR-117, FR-135, FR-157, FR-163 · AD-6 · BR-PAY-6 |
| **Surfaces** | The failure notice (common notification mechanism, transactional) · S-21 (the fix) |

**Preconditions.** An auto-renewing subscription with a stored card token (UC-123).

**Behaviour.**
1. On the renewal date SYS creates the renewal order and charges the stored token for the renewal amount (UC-123). **The fiscal invoice is issued only on confirmed payment** (FR-122, 182/91): an unpaid card renewal has an order and no invoice, and what dunning attaches to is that unpaid renewal order, its due date being the renewal date (FR-135).
2. **Each attempt is idempotent against the renewal period**: a retried or duplicated job never bills a customer twice for one period (UC-123; BR-PAY-6; AD-6's idempotency key).
3. On a **soft decline** the system retries on a schedule held as a configuration artefact beside the dunning sequence (AD-4), so that BR-PAY-6 and FR-135 run on one clock (182/98). Each acquirer adapter classifies its own result codes as soft or hard, so no acquirer code leaves its adapter (AD-8). The attempts are on days 1, 3 and 7 after the failed charge (§12.5.6 task-182 starting-values row). When retries are exhausted it escalates to dunning (UC-124 step 2; FR-135).
4. A **hard decline** (a closed account, a stolen card) is never retried, since repeating it achieves nothing and can trigger acquirer penalties (UC-124).
5. On a failed charge the Organization Administrator is told what failed, what the consequence will be, by when, and what action fixes it (UC-125). **The deadline named is the date dunning would restrict service** (182/98). The notice is transactional and no notification preference suppresses it (UC-125; FR-163).
6. **A subscription with no stored card is renewed by an order created ahead of the period's end** (182/83). At a configured lead time before the period ends SYS creates the renewal order and notifies the Administrator through the common notification mechanism (FR-157). On the transfer rail it issues a proforma (FR-121) and on MIA a request-to-pay (FR-118); the rail is the one the subscription last paid by. The lead time is configuration set beside the notice category, and no value is assumed here. An order still unpaid when the period ends is dunned as in (1) (FR-135), so a customer paying by transfer is not lapsed by omission (DD-8 makes transfer the default for annual and Enterprise billing).

**Configuration-held values.** **Starting value: a soft decline is retried on days 1, 3 and 7** after the failed charge, the failure notice going at the first decline; after day 7 the subscription is past due and dunning takes over (§12.5.6 task-182 starting-values row). **Starting value: the renewal order is created 14 days before the period ends**, leaving a bank transfer time to clear (§12.5.6 task-182 starting-values row).

**Acceptance criteria.**
- **AC-1** Given a renewal job run twice for one renewal period, then one charge results. *(source: FR text; UC-123)*
- **AC-2** Given a soft decline, then the charge is retried on the defined schedule. *(source: FR text; UC-124)*
- **AC-3** Given a hard decline, then no retry is made. *(source: FR text; UC-124 alternate flow)*
- **AC-4** Given a failed charge, then the Administrator receives a notice stating cause, consequence, deadline and remedy, and the notice cannot be suppressed by preference. *(source: FR text; UC-125; FR-163)*
- **AC-5** Given retries are exhausted, then the unpaid amount enters the dunning sequence. *(source: UC-124 step 2; UC-141 trigger)*
- **AC-6** Given a card renewal that is unpaid, then no fiscal invoice exists, no invoice number is consumed, and the unpaid renewal order is what dunning attaches to. *(source: §12.5.6 task-182 payment and fiscal row, 182/91)*
- **AC-7** Given a subscription with no stored card, when its lead time before the period's end is reached, then a renewal order exists with a proforma (transfer) or a request-to-pay (MIA) and the Administrator is notified. *(source: §12.5.6 task-182 payment and fiscal row, 182/83)* Unmet until 60.7.
- **AC-8** Given a decline result, then the acquirer's adapter classifies it soft or hard, the retry schedule is read from configuration, and the failure notice names as its deadline the date dunning would restrict service. *(source: §12.5.6 task-182 payment and fiscal row, 182/98)* Unmet until 194.

**History.**
- 5 Oct 2026 · project owner · an unpaid card renewal has an order and no fiscal invoice; dunning attaches to the order · §12.5.6 task-182 payment and fiscal row (182/91)
- 5 Oct 2026 · project owner · the retry schedule is a configuration artefact, the adapter classifies soft and hard, the notice's deadline is the restriction date · §12.5.6 task-182 payment and fiscal row (182/98)
- 5 Oct 2026 · project owner · a subscription with no stored card is renewed by an order, with a proforma or a request-to-pay, created at a configured lead time · §12.5.6 task-182 payment and fiscal row (182/83)

## 2. Invoicing (index §3.23)
- 5 Oct 2026 · project owner · starting value set (182/98) · §12.5.6 task-182 starting-values row
- 5 Oct 2026 · project owner · starting value set (182/83) · §12.5.6 task-182 starting-values row

### FR-121 — The proforma invoice

**Status.** Not started — remaining 61.1, 68.4

**Obligation.** The system shall issue a proforma invoice on election of bank transfer, carrying payment reference, bank details, amount and validity date, creating no VAT liability and consuming no invoice number.

| | |
|---|---|
| **Actors** | SYS issues. OA downloads it. BO inspects it. |
| **Traces** | UC-126, UC-121, UC-115 · FR-113, FR-119, FR-123 · BR-INV-3 · entity *Proforma invoice* |
| **Surfaces** | S-20 · S-22 (proformas listed) · A-12 |

**Preconditions.** An order that elects the bank transfer rail (UC-126).

**Behaviour.**
1. On election of the transfer rail SYS issues a proforma carrying the payment reference, bank details, amount and validity date (UC-126). The validity date is when the order expires if payment has not arrived: the order's expiry period is configuration (AD-4) tied to the proforma's validity date, and its value is set with the order saga (FR-108; 182/61).
2. A proforma is a payment request, not a fiscal document: it creates no VAT liability and consumes no number from the FR-123 series, which is what lets it be voided with its order (UC-126 rule; BR-INV-3; FR-113).
3. A proforma carries a void state (entity *Proforma invoice*).
4. Transmission to e-Factura is for fiscal invoices and corrective documents (UC-129 trigger), so a proforma is not transmitted.
5. The bank details are the platform's receiving account(s) from configuration, printed as in force at issuance, and the reference follows FR-119's rule (182/97). The validity date is the order's expiry period (182/61).

**Acceptance criteria.**
- **AC-1** Given a transfer election, then a proforma carries payment reference, bank details, amount and validity date. *(source: FR text; UC-126)*
- **AC-2** Given a proforma is issued, then no number is consumed from the invoice series and no VAT liability is created. *(source: FR text; BR-INV-3)*
- **AC-3** Given a proforma, then it is not transmitted to e-Factura. *(source: UC-129 trigger)*

**History.**
- 5 Oct 2026 · project owner · the proforma prints the platform's receiving account(s) from configuration and the reference of FR-119 · §12.5.6 task-182 payment and fiscal row (182/97)

### FR-122 — The fiscal invoice is generated from the order

**Status.** Not started — remaining 61.1, 68.4, 55.4 (the statutory-language rule)

**Obligation.** The system shall generate the fiscal invoice from the order on confirmed payment rather than by manual entry, recording supplier and buyer fiscal identifiers, service description, net amount, VAT rate and amount, and total.

| | |
|---|---|
| **Actors** | SYS issues. BO and OA read. |
| **Traces** | UC-127, UC-134 · D-10 · AD-6, AD-7 · FR-92, FR-123, FR-124 · NFR-58 · BR-INV-1 · entity *Fiscal invoice* |
| **Surfaces** | A-12 (Index and Record) · S-22 |

**Preconditions.** Payment is confirmed on a rail, or approved bank transfer terms apply (UC-127; FR-92). **Approved terms are an Enterprise property recorded on the contract** (FR-144, FR-145), under which the invoice is issued at a scheduled billing point (FR-147) before payment (182/81). On the self-serve transfer rail there are no approved terms: the proforma and its order are the open document, and the invoice is issued when reconciliation confirms the payment (FR-132).

**Behaviour.**
1. The invoice is generated from the order, never typed, so the document and the ledger cannot diverge; there is no manual-entry path (UC-127).
2. It records supplier and buyer fiscal identifiers, service description, net amount, VAT rate and amount, and total (UC-127 step 3).
3. The number is drawn from the series at issuance, inside the issuing transaction (UC-127 step 2; FR-123; AD-7). Issuance moves the saga from paid to invoiced and puts e-Factura transmission, the invoice email and the entitlement change on the outbox in the same transaction (§11.2).
4. Line nets plus VAT equal the stated total to the minor unit. The rounding rule (half-up), its level (per line, then summed) and the VAT base are declared and stored with the document (`architecture.md` §7.8).
5. Once issued, the invoice is immutable (D-10; FR-125).
6. **The fiscal document is printed in Romanian only**, whatever the customer's interface language, and is rendered once at issuance and stored with its XML, so that the document delivered and the document archived are identical (182/86). Only the covering email is in the recipient's own locale (FR-157). The rule that fixes the statutory language is an external fact held as a stated assumption (55.4).

**Acceptance criteria.**
- **AC-1** Given confirmed payment, then an invoice is generated from the order carrying supplier and buyer fiscal identifiers, service description, net, VAT rate and amount, and total. *(source: FR text; UC-127)*
- **AC-2** Given the system, then no path creates an invoice by manual entry. *(source: FR text; UC-127 rule)*
- **AC-3** Given a payment that is not confirmed, then no invoice exists and no number is consumed. *(source: UC-134 rule; AD-7)*
- **AC-4** Given any issued invoice, then its line nets plus VAT equal its total exactly. *(source: `architecture.md` §7.8; NFR-58)*
- **AC-5** Given an invoice, then its printed wording is Romanian in every interface language, it is rendered once at issuance, and a later download is the stored rendering and not a new one. *(source: §12.5.6 task-182 payment and fiscal row, 182/86)*
- **AC-6** Given a self-serve order paid by transfer, then the invoice is issued when reconciliation confirms the payment and not when the proforma is issued. *(source: §12.5.6 task-182 payment and fiscal row, 182/81)* Unmet until 60.2 and 65.3.

**History.**
- 5 Oct 2026 · project owner · approved bank transfer terms are an Enterprise contract property; the self-serve transfer rail invoices on confirmed payment · §12.5.6 task-182 payment and fiscal row (182/81)
- 5 Oct 2026 · project owner · the fiscal document is printed in Romanian only, rendered once at issuance and stored with its XML · §12.5.6 task-182 payment and fiscal row (182/86)

### FR-123 — Gapless numbering per series, per fiscal year

**Status.** Not started — remaining 57.1, 57.2, 57.3, 68.6, 55.4 (the fiscal-year rule)

**Obligation.** The system shall allocate invoice numbers from a gapless, monotonic series per document type per fiscal year, under a lock at issuance and never reserved optimistically at order creation.

| | |
|---|---|
| **Actors** | SYS allocates. BO configures and monitors the series, including the annual roll. |
| **Traces** | UC-134, UC-126, UC-127, UC-133 · D-10 · DR-8 · AD-7 · NFR-34, NFR-55 · T-6 · BR-INV-1 · entity *Numbering series* |
| **Surfaces** | A-12 (the numbering series, Record) |

**Behaviour.**
1. The number is allocated inside the issuing transaction by `SELECT … FOR UPDATE` on the series' counter row, at `READ COMMITTED`; the counter is incremented and the document written in the same transaction (AD-7). A PostgreSQL sequence is rejected because a rolled-back transaction burns a number; an advisory lock is rejected for the reasons AD-7 records.
2. The invariant of record is `UNIQUE (document_type, series, fiscal_year, number)` (AD-7).
3. A number is consumed only at issuance. An abandoned order leaves no hole (FR text; UC-134 rule).
4. The series is per document type and per fiscal year, and rolls at the fiscal-year boundary (FR text; UC-134).
5. The fiscal year a series belongs to is a calendar date plus its timezone, never an instant (NFR-34; task 57.3).
6. Issuance is serialised per series, an accepted cost: at about 200 documents a month it is four orders of magnitude from a bottleneck (T-6).
7. No action offered to the Billing Operator may create a gap (task 68.6; UX-71 for the irreversibility of consuming a number).
8. **Three document types have a series of their own: the fiscal invoice, the credit note and the corrective invoice** (182/84). A proforma has none (FR-121). A number is printed as the series code, the fiscal year and a running integer; the series code is held on the series record and set by the Operator (UC-134). **The fiscal year is the calendar year in `Europe/Chisinau`.** That is a stated assumption pending the statutory rule (55.4): if the rule differs, only the derivation of the year and the roll date change, because the year is already part of the key (AD-7) and an issued document keeps the year it was issued under.

**Boundaries.** Verification floor: invoice numbering is held to 100% line and branch coverage (`architecture.md` §12.5.6 coverage table; OQ-16).

**Acceptance criteria.**
- **AC-1** Given an issuance, then the number is allocated only at that moment and is monotonic and gapless within document type and fiscal year. *(source: FR text; UC-134)*
- **AC-2** Given concurrent issuance with an induced mid-transaction failure, then there is no duplicate and no gap, and a sequence audit confirms it. *(source: NFR-55; AD-7)*
- **AC-3** Given an order abandoned before issuance, then no number was consumed. *(source: UC-134 rule)*
- **AC-4** Given a new fiscal year, then the series rolls and numbering restarts under the new year's key. *(source: FR text; UC-134)*
- **AC-5** Given a document issued near midnight on 31 December, then its fiscal year is decided from the calendar date in the stored originating timezone, not from an instant. *(source: NFR-34; task 57.3)*
- **AC-6** Given an invoice, a credit note and a corrective invoice, then each draws its number from its own series, and a number prints as the series code, the fiscal year and a running integer. *(source: §12.5.6 task-182 payment and fiscal row, 182/84)*
- **AC-7** Given a document issued at the turn of the year, then the fiscal year is the calendar year in `Europe/Chisinau`. *(source: §12.5.6 task-182 payment and fiscal row, 182/84)* Unmet until 55.4 confirms the rule.

**History.**
- 5 Oct 2026 · project owner · three document types, three series; a number is series code, fiscal year and running integer; the fiscal year is the Chisinau calendar year, assumed · §12.5.6 task-182 payment and fiscal row (182/84)

### FR-124 — VAT treatment from residency and VAT status

**Status.** Not started — remaining 61.4, 68.4, 55.4 (the tax adviser's confirmation)

**Obligation.** The system shall derive VAT treatment from the customer's residency and VAT status — standard-rate domestic supply, or the applicable export or reverse-charge treatment — stating the basis on the document and drawing rates and rules from maintained data.

| | |
|---|---|
| **Actors** | SYS applies. BO maintains the data (FR-148). |
| **Traces** | UC-128, UC-108, UC-109, UC-160 · AD-4 · NFR-58, NFR-73 · FR-110, FR-148 · BR-INV-4 |
| **Surfaces** | S-19 (the order summary's VAT rate and basis) · A-12 (the stated VAT basis) |

**Preconditions.** Customer residency and VAT status are known (UC-108, UC-109), and VAT rules are in force (UC-160).

**Behaviour.**
1. Triggered by an invoice or an order-total calculation (UC-128): the same derivation prices the order summary and the invoice.
2. A domestic customer receives standard-rate Moldovan VAT. A non-resident receives the applicable export or reverse-charge treatment (UC-128 step 1).
3. The basis is stated on the document (UC-128 step 2).
4. Rates and rules come from effective-dated data, because they change by legislation on their own timetable and a change must not need a deployment (UC-128 rule; FR-148).
5. VAT amounts are rounded at issuance by the rule declared in `architecture.md` §7.8.
6. **Three treatments are defined now, each with its selection rule and the basis stated on the document** (182/85). **Residency is derived from the country of the billing account's legal address** (FR-106) and is not held as a field of its own. (a) *Domestic supply*: the country is Moldova; the standard rate applies, and the basis states a domestic supply at the standard rate. (b) *Export*: the country is not Moldova and the account holds no VAT registration code; VAT is charged at zero, and the basis states a supply outside the Republic of Moldova. (c) *Reverse charge*: the country is not Moldova and the account holds a VAT registration code; no VAT is charged, and the basis states that the recipient accounts for the tax. Each row, its rate and its basis wording are effective-dated data in the `vat_rule` artefact (FR-148), and the wording is a catalogue key printed in the document's language (FR-122). **The selection rules, the zero rate and the basis meanings are a stated assumption pending a tax adviser's confirmation (55.4)**: if they differ, the `vat_rule` rows change as data and no code does, which is the point of AD-4; only the two inputs, the legal-address country and the VAT registration code, are fixed.
7. At the MVP every customer is a Moldovan business (DD-9), so every invoice issued is domestic. The other two rows exist so that activating the merchant-of-record rail (DD-8) is configuration, and they are exercised by test data until then.

**Configuration-held values.** The sources record the standard Moldovan rate at 20%, with no reduced rate for digital services (`use_cases.md` §6.2; BR-INV-4). No artefact is seeded; the rules arrive with task 61.4 (`config/seed/README.md`).

**Boundaries.** Verification floor: VAT calculation is held to 100% line and branch coverage (`architecture.md` §12.5.6 coverage table; OQ-16).

**Acceptance criteria.**
- **AC-1** Given a domestic customer, then the document carries standard-rate treatment. *(source: FR text; UC-128)*
- **AC-2** Given a billing account whose legal-address country is not Moldova and that holds no VAT registration code, then the document carries the export treatment. *(source: FR text; UC-128; §12.5.6 task-182 payment and fiscal row, 182/85)*
- **AC-3** Given any document, then it states the basis of its VAT treatment. *(source: FR text; UC-128 step 2)*
- **AC-4** Given a rate or rule changed in FR-148's data, then the next calculation applies it with no deployment. *(source: FR text; NFR-73)*
- **AC-5** Given a billing account whose legal-address country is not Moldova and that holds a VAT registration code, then the document carries the reverse-charge treatment. *(source: FR text; UC-128; §12.5.6 task-182 payment and fiscal row, 182/85)*
- **AC-6** Given a billing account, then its residency is the country of its legal address, and no separate residency field exists. *(source: §12.5.6 task-182 payment and fiscal row, 182/85)*

**History.**
- 5 Oct 2026 · project owner · all three VAT treatments are defined now, residency derived from the billing account's legal-address country; the selection rules are assumed pending a tax adviser (the owner chose this over shipping the domestic rule alone) · §12.5.6 task-182 payment and fiscal row (182/85)

### FR-125 — An issued invoice is immutable

**Status.** Not started — remaining 55.1, 57.4, 66.2, 68.5, 66.4 (the issue-corrections permission)

**Obligation.** The system shall treat an issued invoice as immutable, changing its effect only through a credit note or corrective invoice referencing the original, itself transmitted to e-Factura.

| | |
|---|---|
| **Actors** | BO issues a credit note or corrective invoice. SYS issues the credit note a refund generates (FR-139). Nobody edits. |
| **Traces** | UC-133, UC-129, UC-145 · D-10 · DR-8 · AD-6 · BR-INV-2 · entity *Credit note / corrective invoice* |
| **Surfaces** | A-12 (read-only for every issued document; UX-71 on issuing a correction) · S-22 (no edit of fiscal content) |

**Preconditions.** An issued invoice to correct — a refund, a cancelled service, or a genuine error (UC-133).

**Behaviour.**
1. The invoice model has no update path at any layer, from domain to database (task 55.1; DR-8).
2. A correction is a separate document referencing the original, and it is itself transmitted to e-Factura (UC-133; UC-129 trigger).
3. In the order saga the compensation out of *invoiced* is *credit note issued* (AD-6). A refund changes an invoice's effect through a credit note and never an edit (task 66.2).
4. The console offers no edit: issuing a correction is distinguished as irreversible by design and states its compensating mechanism, the credit note (A-12; UX-71; task 68.5).
5. An order with an issued fiscal invoice is not cancellable by FR-113's path.
6. **A credit note is issued for a refund or a cancellation, and a corrective invoice for a genuine error** (182/84), each drawing its number from its own series (FR-123). Issuing either by hand needs the *issue corrections* permission (182/93); the credit note a refund generates is the system's act and needs neither that permission nor the refund permission.

**Acceptance criteria.**
- **AC-1** Given the system, then no path edits an issued invoice. A prohibition: verified by showing the state is unreachable. *(source: FR text; task 55.1)*
- **AC-2** Given a correction, then it is a separate document referencing the original and is transmitted per FR-126. *(source: FR text; UC-133)*
- **AC-3** Given a credit note issued against an invoice, then the original is unchanged. *(source: task 57.4)*
- **AC-4** Given the console, then no affordance edits an issued invoice. *(source: A-12; task 68.5)*
- **AC-5** Given a Billing Operator account without the *issue corrections* permission, then it cannot issue a credit note or a corrective invoice by hand. *(source: §12.5.6 task-182 payment and fiscal row, 182/93)* Unmet until 66.4.

**History.**
- 5 Oct 2026 · project owner · a credit note answers a refund or a cancellation, a corrective invoice a genuine error, each in its own series · §12.5.6 task-182 payment and fiscal row (182/84)
- 5 Oct 2026 · project owner · issuing a correction by hand is a permission of its own, never held with the refund permission · §12.5.6 task-182 payment and fiscal row (182/93)

### FR-126 — Render to national XML and transmit to e-Factura

**Status.** Not started — remaining 55.4 (the specification), 55.2, 55.3, 56.1, 56.2, 68.4

**Obligation.** The system shall render the invoice into the required national e-Factura XML format and transmit it, storing the platform's acknowledgement and identifier against the invoice record.

| | |
|---|---|
| **Actors** | SYS renders and transmits. BO sees the result (A-12). |
| **Traces** | UC-129, UC-127, UC-133, UC-135 · D-9 · DR-9 · AD-6, AD-8 · NFR-54, NFR-71, NFR-91, NFR-93 · T-5 · R-6 · BR-INV-6 · entity *e-Factura transmission record* |
| **Surfaces** | A-12 (the acknowledgement and identifier) · A-13 (when it fails; FR-127) |

**Preconditions.** A fiscal invoice has been issued (UC-127) with valid fiscal identifiers (UC-109; FR-107).

**Behaviour.**
1. Triggered by the issuance of a fiscal invoice or a corrective document (UC-129).
2. The internal invoice is a platform-owned record that an adapter behind `EInvoicingPort` renders into the national XML and transmits; it is not a PDF that happens to be emailed (D-9; AD-8).
3. Transmission goes through the outbox, written in the issuing transaction (AD-6). An untransmitted invoice is a **tracked exception with an owner**, never a blocked checkout (NFR-71; R-6; task 56.1).
4. The platform's acknowledgement and identifier are stored against the invoice record (UC-129 step 3).
5. A dispatcher restart must not duplicate a submission: the adapter declares a recovery query that looks the invoice up by number before retransmitting (AD-6; T-5; task 55.3).
6. Acknowledgements are processed idempotently under duplicate, delayed and out-of-order delivery (NFR-54).
7. A daily transmission reconciliation must show no unacknowledged invoice beyond tolerance (NFR-71). The tolerance is unquantified in the source (`non_functional_requirements.md` OQ-9). An e-Factura rejection raises an operational alert (NFR-91).
8. Peppol for cross-border exchange is anticipated and not built (`architecture.md` §8.3; D-9).
9. **The specification is a verification task that precedes any build against it** (182/87). The XML format and its version, the transport and authentication, the acknowledgement time, and the timing and retry policy between issuance and transmission are obtained and recorded in `architecture.md` §12.5.6 by 55.4 before task 56.1. **Assumed meanwhile:** every issued fiscal invoice and every corrective document is in scope, and a proforma is not; transport is direct to the national platform with no intermediary; transmission is attempted from the outbox as soon as the document is issued and retried on failure. If the specification differs, only the adapter behind `EInvoicingPort` and its configuration change (NFR-14), because the model, the numbering and the outbox do not depend on it. The mandate is already in effect (1 October 2026), so this is the question with a date on it.

**Acceptance criteria.**
- **AC-1** Given an issued invoice, then it is rendered into the national XML format and transmitted. *(source: FR text; UC-129)* Unmet until 55.4.
- **AC-2** Given a transmission, then the acknowledgement and platform identifier are stored against the invoice record. *(source: FR text; UC-129 step 3)*
- **AC-3** Given a transmission fails, then checkout is unaffected and an exception with an owner is raised. *(source: NFR-71; task 56.1)*
- **AC-4** Given a dispatcher restart mid-submission, then the invoice is not submitted twice. *(source: AD-6; T-5; task 55.3)*
- **AC-5** Given a credit note or corrective invoice, then it is transmitted too. *(source: FR-125; UC-129 trigger)*
- **AC-6** Given a proforma, then it is not transmitted, and every issued fiscal invoice and corrective document is. *(source: §12.5.6 task-182 payment and fiscal row, 182/87)* Unmet until 55.4.

**History.**
- 5 Oct 2026 · project owner · e-Factura's format, transport and timing are a verification task before 56.1; all issued invoices and corrective documents are assumed in scope, direct transport · §12.5.6 task-182 payment and fiscal row (182/87)

### FR-127 — A rejection is surfaced and reissued, never marked delivered

**Status.** Not started — remaining 56.1, 56.3, 68.7, 55.4 (whether a rejected document counts as issued)

**Obligation.** The system shall surface a transmission rejection with its reason and support reissue after the underlying data is corrected, and shall never mark an untransmitted invoice as delivered.

| | |
|---|---|
| **Actors** | BO sees the reason, corrects the data and reissues. |
| **Traces** | UC-130, UC-108, UC-109 · D-9 · NFR-71, NFR-91 · FR-126, FR-107 · entity *e-Factura transmission record* |
| **Surfaces** | A-13 (Exception queue) · A-12 · S-23 (where a buyer-code fault is corrected) |

**Preconditions.** A transmission was rejected: a schema failure, an unknown or mismatched fiscal code, or a platform outage (UC-130).

**Behaviour.**
1. The Operator sees the rejection reason, corrects the underlying data, and reissues (UC-130).
2. The invoice is never silently marked delivered on a failed transmission, because an untransmitted B2B invoice is a compliance exposure (UC-130 rule; A-13).
3. A rejection caused by an invalid buyer fiscal code routes back to the tenant's billing account data (S-23), which cannot be fixed by editing the invoice (A-13).
4. Each step of correction and reissue is recorded (task 56.3). A rejection raises an operational alert (NFR-91).
5. **Reissue depends on the cause** (182/88). Where the cause is a platform outage or a failure of the platform's own schema rendering, the same document is retransmitted, keeping its number and consuming none. Where the cause is the data (an unknown or mismatched buyer fiscal code, or any wrong content), the invoice is cancelled by a credit note and a new invoice that references it is issued (FR-125), each with its own number. **Assumed:** e-Factura does not register a rejected document, so retransmitting the same one is lawful. If it does register it, retransmission is dropped and every cause takes the credit-note path, which loses the property that an outage heals without consuming a number and nothing else.

**Acceptance criteria.**
- **AC-1** Given a rejected transmission, then its reason is shown. *(source: FR text; UC-130 step 1)*
- **AC-2** Given the underlying data is corrected, then reissue is possible. *(source: FR text; UC-130)*
- **AC-3** Given any invoice that has not been transmitted, then it never carries a delivered state. A prohibition. *(source: FR text; UC-130 rule)*
- **AC-4** Given a rejected transmission corrected and reissued, then each step is recorded. *(source: task 56.3)*
- **AC-5** Given a rejection caused by an outage or by the platform's own schema rendering, then the same document is retransmitted under its own number and no number is consumed. *(source: §12.5.6 task-182 payment and fiscal row, 182/88)*
- **AC-6** Given a rejection caused by the data, then the invoice is cancelled by a credit note and a new invoice referencing it is issued. *(source: §12.5.6 task-182 payment and fiscal row, 182/88)*

**History.**
- 5 Oct 2026 · project owner · reissue is by cause: retransmit the same document for an outage or platform-side schema failure, credit note plus a new invoice for a data cause · §12.5.6 task-182 payment and fiscal row (182/88)

### FR-128 — Deliver the invoice, and keep it available

**Status.** Not started — remaining 61.2, 63.6, 68.4

**Obligation.** The system shall deliver the invoice to the billing contact and make it available in the billing area, recording delivery timestamp and channel, and shall keep invoice history and document download available after downgrade, cancellation and lapse.

| | |
|---|---|
| **Actors** | SYS delivers. OA lists and downloads. BO reads all. |
| **Traces** | UC-131, UC-132, UC-108 · D-13 · UX-54 · NFR-31, NFR-84 · FR-104, FR-157, FR-163, FR-170 · BR-INV-8 |
| **Surfaces** | S-22 (Index; read-only that survives entitlement loss) · A-12 (delivery timestamp and channel) |

**Preconditions.** A fiscal invoice has been issued and a billing contact exists (UC-131).

**Behaviour.**
1. On issuance the invoice is delivered to the billing contact and made available in the billing area (UC-131 steps 1, 2).
2. Delivery runs on the common notification mechanism as a transactional category (UC-131 rule; FR-157), so no preference suppresses it (FR-163). It is recorded with timestamp and channel (UC-131 step 3; index §7.4).
3. **Delivery and e-Factura transmission are separate obligations that fail independently**, and are recorded separately (task 61.2).
4. The billing area shows the full history — number, date, period, amount, VAT, status, payment date — and any document can be downloaded (UC-132). It also lists proformas and credit notes, the customer's purchase-order reference and a foreign-currency document's recorded rate (S-22).
5. History and download remain available after downgrade, cancellation and lapse, because the customer's duty to retain the document outlives the subscription (UC-132; D-13; NFR-31; UX-54).
6. **The customer receives and downloads the rendered document as a PDF** (182/86). The e-Factura XML is the transmitted record, held with that document and read by the Operator in A-12; it is not offered to the customer. The document is rendered once at issuance and stored, so every download is the same document, and the covering email is in the recipient's own locale. If a customer later needs the XML for their own accounting, a second download is additive.

**Acceptance criteria.**
- **AC-1** Given an issued invoice, then it is delivered to the billing contact and listed in the billing area. *(source: FR text; UC-131)*
- **AC-2** Given a delivery, then its timestamp and channel are recorded, distinct from the transmission record. *(source: FR text; task 61.2)*
- **AC-3** Given an invoice in the billing area, then the Administrator can download it. *(source: FR text; UC-132 step 2)*
- **AC-4** Given a subscription that is downgraded, cancelled or lapsed, then invoice history and downloads remain available. *(source: FR text; UC-132; D-13)*
- **AC-5** Given an issued invoice, then the customer is offered the PDF rendering stored at issuance, and the XML is read only in A-12. *(source: §12.5.6 task-182 payment and fiscal row, 182/86)*

**History.**
- 5 Oct 2026 · project owner · the customer receives the stored PDF rendering; the XML is the transmitted record read by the Operator · §12.5.6 task-182 payment and fiscal row (182/86)

### FR-129 — The BNM rate on a foreign-currency invoice

**Status.** Not started — remaining 61.5, 68.4

**Obligation.** The system shall store the National Bank of Moldova official rate for the invoice date on any foreign-currency invoice and reproduce it on the document.

| | |
|---|---|
| **Actors** | SYS records. BO inspects (A-12). |
| **Traces** | UC-136, UC-127, UC-162 · D-14 · AD-4, AD-8 · NFR-34, NFR-58, NFR-73 · FR-150 · BR-INV-5 · entity *Exchange rate record* |
| **Surfaces** | A-12 · S-22 (the recorded rate on a foreign-currency document) |

**Preconditions.** The invoice is denominated in EUR or USD (UC-136).

**Behaviour.**
1. On issuance SYS records the BNM official rate for the invoice date on the invoice record and reproduces it on the document (UC-136).
2. The MDL equivalent, not the foreign amount, is what the fiscal return and the accounting ledger are built from (UC-136 rule; D-14). It is computed once, at issuance, from the stored rate (NFR-58; `architecture.md` §7.8).
3. The rate date is a calendar date, stored beside the rate (NFR-34; task 61.5).
4. The rate is reached through `ExchangeRatePort`; its sourcing is effective-dated configuration (AD-8; AD-4; NFR-73).
5. Prices are set per plan per currency by hand and are not converted at display (D-14). An invoice is denominated in the currency of its order, which the customer picked among the currencies the plan version is priced in; MDL is always priced (FR-86; 182/66).
6. **A day with no published rate takes the last rate published on or before the invoice date**, and that rate's own date is stored beside it, so the document shows which day's rate it used (182/99). **A rate source that cannot be reached makes issuance wait**: no number is consumed (AD-7), the order stays paid and not yet invoiced, and that residual state is surfaced to the Billing Operator as any saga inconsistency is (NFR-59). Which currencies a plan is priced in and billed in is settled at 182/66.

**Acceptance criteria.**
- **AC-1** Given a EUR- or USD-denominated invoice, then the BNM rate for its invoice date is stored on the invoice record. *(source: FR text; UC-136)*
- **AC-2** Given that invoice, then the document shows the rate. *(source: FR text; UC-136 step 2)*
- **AC-3** Given the invoice, then its MDL equivalent is computed once at issuance from the stored rate. *(source: NFR-58)*
- **AC-4** Given the stored rate, then its rate date is stored with it as a calendar date. *(source: task 61.5; NFR-34)*
- **AC-5** Given an invoice date with no published rate, then the last rate published on or before it is used and that rate's date is stored. *(source: §12.5.6 task-182 payment and fiscal row, 182/99)*
- **AC-6** Given the rate source cannot be reached, then issuance waits, no number is consumed, and the order remains paid and not invoiced. *(source: §12.5.6 task-182 payment and fiscal row, 182/99; AD-7)*

**History.**
- 5 Oct 2026 · project owner · a day with no rate uses the last published one with its own date; an unreachable source makes issuance wait · §12.5.6 task-182 payment and fiscal row (182/99)

### FR-130 — Archive fiscal documents for the statutory period

**Status.** Not started — remaining 61.6 (the archive writer), 55.4 (statutory form and retention start), 68.6, 71.2, 73.3, 73.7 (the retrieval runbook)

**Obligation.** The system shall archive issued fiscal documents and their transmission receipts in immutable storage for the statutory retention period, taking precedence over a customer erasure request.

| | |
|---|---|
| **Actors** | SYS archives. BO ensures and monitors the archive (UC-135). A data subject's erasure request defers to it. |
| **Traces** | UC-135, UC-127, UC-129 · D-9 · DR-8 · NFR-28, NFR-29, NFR-36, NFR-72 · `architecture.md` OQ-11, §12.5.7 · BR-INV-7 · entity *Fiscal document archive* |
| **Surfaces** | A-12 (the statutory archive; task 68.6) |

**Behaviour.**
1. Issued documents and their transmission receipts are retained in immutable storage for at least six years (UC-135; BR-INV-7; §12.5.7).
2. Storage is S3-compatible object storage in the EU with versioning and Object Lock in Compliance mode, so that no one, the owner included, can delete before expiry. It is a different provider from compute, so that independence is true by construction (`architecture.md` OQ-11).
3. Documents are kept in statutory form and are retrievable independently of the application, the database and the hosting provider (NFR-72).
4. Retention is a system guarantee and not a backup policy. It survives a customer's deletion request, which is where the erasure workflow defers to fiscal law (UC-135 rule; NFR-29), and the retained categories are reported back to the requester (NFR-29).
5. **At acknowledgement, the transmitted XML, the platform's acknowledgement and the rendered document are archived together** (182/89); that bundle is the statutory form. The six years run from the end of the fiscal year of issue. At expiry the object lock lapses and nothing is deleted automatically; no deletion path is built. A document is retrieved independently of the application by a runbook against the bucket (73.7). **Assumed:** the statutory form and the start of retention are as stated; both are an external fact to confirm (55.4). If retention starts at issuance, or the statutory form is the rendered document alone, only the archive writer's trigger and contents change.

**Refusals.** An erasure request does not remove an archived document.

**Acceptance criteria.**
- **AC-1** Given an issued document and its transmission receipt, then both are stored immutably for the statutory period. *(source: FR text; UC-135)*
- **AC-2** Given an erasure request from a customer, then the archived documents remain and the requester is told the retained categories. *(source: FR text; NFR-29)*
- **AC-3** Given an archived document, then no one can delete it before its retention expires. *(source: `architecture.md` OQ-11)*
- **AC-4** Given the archive, then a document is retrievable independently of the application, the database and the hosting provider. *(source: NFR-72, verified by NFR-36)*
- **AC-5** Given an acknowledged invoice, then its transmitted XML, the acknowledgement and its rendered document are archived together. *(source: §12.5.6 task-182 payment and fiscal row, 182/89)* Unmet until 55.4.
- **AC-6** Given an archived document, then its retention runs six years from the end of the fiscal year of issue. *(source: §12.5.6 task-182 payment and fiscal row, 182/89)* Unmet until 55.4.

**History.**
- 18 Aug 2026 · architecture OQ-11 · Object Lock in Compliance mode verified as the deciding capability: the fiscal archive is object-locked storage on a provider other than compute · `architecture.md` OQ-11, §12.5
- 5 Oct 2026 · project owner · the statutory form is the transmitted XML, the acknowledgement and the rendered document, archived together at acknowledgement; retention from the end of the fiscal year of issue; retrieval by a runbook · §12.5.6 task-182 payment and fiscal row (182/89)

## 3. Reconciliation (index §3.24)

### FR-131 — Import a bank statement

**Status.** Not started — remaining 65.3, 68.8, 193 (which bank, and its file format)

**Obligation.** The system shall import bank account statements by file, and by bank API once that is added (182/100), into a reconciliation workspace.

| | |
|---|---|
| **Actors** | BO imports. |
| **Traces** | UC-137, UC-121, UC-138 · D-8 · NFR-93 · entity *Bank statement import* |
| **Surfaces** | A-10 (Exception queue: "import a statement by file or bank API") |

**Preconditions.** Access to the account statement by file or bank API (UC-137).

**Behaviour.**
1. The Operator imports the statement into the reconciliation workspace (UC-137).
2. This exists because the transfer rail settles asynchronously with no callback: without an inbound statement the platform cannot know a customer has paid (UC-137 rule).
3. Importing lines triggers automatic matching (UC-138; FR-132).
4. A scheduled import reports explicit success or failure, with absence alerting (NFR-93).
5. **One file format is accepted first: the statement file of the bank that holds the operating account** (182/100). Which bank that is, and its format, is an external fact the project owner supplies (193). **A statement line is identified by its bank reference, date and amount**, so importing the same statement twice adds nothing. **Bank-API import comes later and is not an MVP behaviour**; when a scheduled pull exists it reports success or failure as in (4).

**Acceptance criteria.**
- **AC-1** Given a statement file, when it is imported, then its lines appear in the reconciliation workspace. *(source: FR text; UC-137)*
- **AC-2** Given a bank API, when a statement is imported through it, then its lines appear in the workspace. *(source: FR text; UC-137)* Deferred beyond the MVP: the API pull follows the file import (§12.5.6 task-182 payment and fiscal row, 182/100).
- **AC-3** Given imported lines, then automatic matching runs on them. *(source: UC-138 trigger)*
- **AC-4** Given a statement imported twice, then the second import adds no line, a line being identified by bank reference, date and amount. *(source: §12.5.6 task-182 payment and fiscal row, 182/100)*
- **AC-5** Given the operating bank's statement file, then it is accepted in that bank's format. *(source: §12.5.6 task-182 payment and fiscal row, 182/100)* Unmet until 193.

**History.**
- 5 Oct 2026 · project owner · the file of the operating bank is imported first, a line is identified by bank reference, date and amount, and the bank-API pull is deferred · §12.5.6 task-182 payment and fiscal row (182/100)

### FR-132 — Match payments automatically

**Status.** Not started — remaining 60.2, 65.3, 68.8

**Obligation.** The system shall match statement lines to open orders and invoices automatically on payment reference, amount and payer fiscal code, marking the invoice paid and provisioning the subscription on a confident match.

| | |
|---|---|
| **Actors** | SYS matches. BO resolves what it cannot. |
| **Traces** | UC-138, UC-121, UC-143 · D-8 · FR-92, FR-119, FR-133 · BR-PAY-4 · entity *Reconciliation match / exception* |
| **Surfaces** | A-10 (confident automatic matches; accept or reject a proposed match) |

**Preconditions.** Statement lines are imported and open orders and invoices exist (UC-138).

**Behaviour.**
1. SYS matches each line to an open order or invoice on payment reference, amount and payer fiscal code (UC-138 step 1).
2. On a confident match it marks the invoice paid and provisions the subscription, with no operator action (UC-138 steps 2, 3; A-10: *provisioning follows a confident match*).
3. Where no confident match is possible the line goes to the exception workspace (UC-138 alternate flow; FR-133).
4. Automatic matching is what keeps the transfer rail from becoming a manual back office (UC-138 rule).
5. **A match is confident only when the reference, the amount and the payer's fiscal code are all exactly equal and exactly one candidate qualifies**; anything else is an exception (182/101). The payer's fiscal code is the IDNO on the statement line, compared with the billing account's. A line with no payer code, and a line matching two documents, are exceptions. **The document matched is the open one** (182/81): on the self-serve transfer rail it is the proforma and its order, after which the fiscal invoice is issued and entitlements follow (FR-122; BR-PAY-4), and under an Enterprise contract's approved terms it is the fiscal invoice already issued at its billing point (FR-147).

**Acceptance criteria.**
- **AC-1** Given a line whose reference, amount and payer fiscal code match an open invoice or, on the self-serve transfer rail, an open proforma, then the payment is recorded, the invoice is marked paid (issued, for a proforma) and the subscription is provisioned with no operator action. *(source: FR text; UC-138; §12.5.6 task-182 payment and fiscal row, 182/81)*
- **AC-2** Given a line with no confident match, then it appears in the exception workspace. *(source: UC-138 alternate flow)*
- **AC-3** Given a line whose reference and amount match but whose payer fiscal code differs or is absent, or which matches two documents, then it is an exception and nothing is settled. *(source: §12.5.6 task-182 payment and fiscal row, 182/101)*

**History.**
- 5 Oct 2026 · project owner · a confident match is exact equality on reference, amount and payer code with one candidate · §12.5.6 task-182 payment and fiscal row (182/101)
- 5 Oct 2026 · project owner · the document matched is the open one: the proforma on the self-serve transfer rail, the issued invoice under Enterprise approved terms · §12.5.6 task-182 payment and fiscal row (182/81)

### FR-133 — The exception workspace

**Status.** Not started — remaining 65.4, 68.8

**Obligation.** The system shall provide an exception workspace for missing or mistyped references, partial payments, overpayments, third-party payments and duplicates, recording every resolution with its rationale.

| | |
|---|---|
| **Actors** | BO works exceptions. |
| **Traces** | UC-139, UC-140, UC-163 · UX-125 · NFR-91 · FR-134, FR-151 · entity *Reconciliation match / exception* |
| **Surfaces** | A-10 (dense table, saved filters, bulk action, per-item resolution with mandatory rationale) |

**Preconditions.** An exception from automatic matching (UC-139).

**Behaviour.**
1. The five classes are a missing or mistyped reference, a partial payment, an overpayment, a payment from a third party on the customer's behalf, and a duplicate (UC-139).
2. The Operator works each exception and every resolution is recorded with its rationale, because a manual match is a financial assertion (UC-139; UX-125).
3. An exception reaches a queue with an owner (task 65.4).
4. Unreconciled settlements beyond tolerance raise an operational alert (NFR-91).
5. **Resolutions are a closed set of four** (182/90): *apply to a document*, *apply in part and keep the document open*, *refund through FR-139* and *reject*. Admitted per class: a missing or mistyped reference takes *apply* or *reject*; a partial payment takes *apply in part*, the invoice staying open for the balance and never being marked paid by a part; an overpayment takes *apply* for the amount due and *refund* for the surplus; a payment from a third party takes *apply*, *refund* or *reject*; a duplicate takes *refund* or *reject*. The Operator who claims an exception owns it (task 65.4). Each resolution is a manual-match ledger entry carrying its rationale (FR-151).

**Acceptance criteria.**
- **AC-1** Given each of the five exception classes, then it can be presented in the workspace. *(source: FR text; UC-139)*
- **AC-2** Given a manual resolution, then a rationale is required and recorded with it. *(source: FR text; UX-125)*
- **AC-3** Given a new exception, then it appears in a queue with an owner. *(source: task 65.4)*
- **AC-4** Given an exception, then only the resolutions admitted for its class are offered, and a resolution outside the set of four cannot be recorded. *(source: §12.5.6 task-182 payment and fiscal row, 182/90)*
- **AC-5** Given a partial payment applied in part, then the invoice stays open for the balance and is not marked paid. *(source: §12.5.6 task-182 payment and fiscal row, 182/90)*
- **AC-6** Given an exception the Operator claims, then the Operator owns it until it is resolved. *(source: §12.5.6 task-182 payment and fiscal row, 182/90)*

**History.**
- 5 Oct 2026 · project owner · reconciliation resolutions are a closed set of four, admitted per class; the claimer owns the exception · §12.5.6 task-182 payment and fiscal row (182/90)

### FR-134 — Manual settlement, with a reason, on the ledger

**Status.** Not started — remaining 61.3, 65.4, 68.8

**Obligation.** The system shall permit manual settlement of an invoice only with a stated reason, written to the immutable billing audit ledger.

| | |
|---|---|
| **Actors** | BO. |
| **Traces** | UC-140, UC-139, UC-163 · UX-125 · FR-119, FR-151 · BR-COL-4, BR-LED-1 |
| **Surfaces** | A-10 ("manually mark an invoice paid") |

**Preconditions.** An open invoice settled outside the automated flow: an offline arrangement, an offset, or a payment through an unsupported channel (UC-140).

**Behaviour.**
1. The Operator marks the invoice paid and states a reason; the action is written to the ledger (UC-140).
2. The reason is mandatory and the entry is immutable, because this is the single most abusable capability in the billing domain (UC-140 rule; BR-COL-4).
3. Manual settlement is one of the two routes that release provisioning on the transfer rail (FR-119's acceptance criterion).
4. The entry is the ledger's *manual match* class (UC-163; FR-151).
5. A manual settlement that clears the last overdue amount restores service like any other settlement (FR-137; 182/92).

**Refusals.** A settlement with no stated reason is refused (FR text).

**Acceptance criteria.**
- **AC-1** Given a manual settlement with no reason, then it is refused. *(source: FR text; UC-140)*
- **AC-2** Given a manual settlement, then an entry is written to the FR-151 ledger. *(source: FR text; UC-140 step 2)*
- **AC-3** Given that entry, then no path edits or deletes it. *(source: BR-LED-1; NFR-33)*

## 4. Collections (index §3.25)

### FR-135 — Dunning from a configured sequence

**Status.** Not started — remaining 65.1, 68.9, 194 (the default sequence)

**Obligation.** The system shall escalate an unpaid amount (an overdue renewal order, or a fiscal invoice issued before payment) through a configurable dunning sequence at defined intervals, each notice stating the amount, the due date passed and the date service will be restricted, stopping immediately on payment.

| | |
|---|---|
| **Actors** | SYS runs the sequence. OA receives each notice. BO configures it and may advance or halt it. |
| **Traces** | UC-141, UC-124, UC-142 · AD-4 · NFR-91, NFR-93 · FR-157, FR-163, FR-173 · BR-COL-1 · entity *Dunning state* |
| **Surfaces** | A-11 (Exception queue: overdue invoices with amount, due date passed, stage and restriction date; configure the sequence and intervals; advance or halt) · the dunning notice |

**Preconditions.** An unpaid amount past its due date (UC-141). **Dunning attaches to the unpaid renewal order** (its amount, with the renewal date as its due date) **when no fiscal invoice exists, and to the fiscal invoice where one was issued before payment** under an Enterprise contract's approved terms (182/81, 182/91). No fiscal invoice is issued for an unpaid renewal, since an irreversible document that may never be paid would contradict FR-122 and D-10.

**Behaviour.**
1. Triggered by passage of the due date, or by exhaustion of charge retries (UC-141; UC-124).
2. SYS escalates through a configured sequence of reminders at defined intervals; each states the amount, the due date passed and the date service will be restricted (UC-141).
3. The sequence stops immediately on payment (UC-141 alternate flow).
4. **The schedule is configuration, not code**: it changes with no deployment (UC-141 rule; FR text; task 65.1).
5. When dunning is exhausted, FR-136 applies (UC-141 exception flow).
6. Reminders travel on the common notification mechanism (FR-157). **The reminder is transactional, so no notification preference suppresses it, and it goes to every Organization Administrator** (182/102; FR-163), as UC-125's failure notice does. The default sequence is reminders at the due date +1, +7 and +14 days and restriction at +21, seeded by 194 (§12.5.6 task-182 starting-values row).
7. The job reports explicit success or failure, and a dunning backlog raises an operational alert (NFR-93; NFR-91).

**Configuration-held values.** **Starting value: reminders at due date +1, +7 and +14 days, restriction at +21**, each reminder stating the amount, the due date passed and the restriction date (§12.5.6 task-182 starting-values row).

**Acceptance criteria.**
- **AC-1** Given an overdue invoice, then notices are raised at the configured intervals. *(source: FR text; UC-141)*
- **AC-2** Given a notice, then it states the amount, the due date passed and the date service will be restricted. *(source: FR text; UC-141 step 2)*
- **AC-3** Given payment, then the sequence stops immediately. *(source: FR text; UC-141)*
- **AC-4** Given the schedule is changed in configuration, then the next run follows it with no deployment. *(source: FR text; task 65.1)*
- **AC-5** Given an unpaid card renewal, then dunning attaches to the renewal order; given an invoice issued before payment, then it attaches to that invoice. *(source: §12.5.6 task-182 payment and fiscal row, 182/91)*
- **AC-6** Given a dunning reminder, then no notification preference suppresses it and it reaches every Organization Administrator of the organization. *(source: §12.5.6 task-182 payment and fiscal row, 182/102; FR-163)*

**History.**
- 5 Oct 2026 · project owner · dunning attaches to the unpaid renewal order, or to an invoice issued before payment · §12.5.6 task-182 payment and fiscal row (182/91)
- 5 Oct 2026 · project owner · the dunning reminder is transactional and goes to every Organization Administrator; the default sequence was set the same day · §12.5.6 task-182 payment and fiscal row (182/102), starting-values row
- 5 Oct 2026 · project owner · starting value set (182/102) · §12.5.6 task-182 starting-values row

### FR-136 — Restrict service without deleting anything

**Status.** Not started — remaining 65.2, 68.9

**Obligation.** The system shall move the subscription to suspended when dunning is exhausted, making out-of-entitlement reports and entities read-only and blocking new exports, and shall tell the Administrator exactly what changed and how to restore it.

| | |
|---|---|
| **Actors** | SYS suspends. OA is told. BO sees suspended subscriptions (A-11). |
| **Traces** | UC-142, UC-141, UC-151 · D-13 · UX-54 · NFR-31 · FR-90, FR-103, FR-104, FR-163 · BR-ENT-4 |
| **Surfaces** | A-11 (suspended subscriptions) · the service-restriction notice · S-22 (still readable) |

**Preconditions.** Dunning is exhausted (UC-142).

**Behaviour.**
1. The subscription moves to suspended (UC-142 step 1; FR-90).
2. Reports and entities beyond the Free entitlement become read-only and new exports are blocked; previously generated documents remain downloadable (UC-142 steps 2, 3).
3. Which content is read-only follows the deterministic rule of FR-103 (UC-142 rule; UC-151).
4. **Nothing is deleted** (D-13; FR-104). Export of what the customer already holds keeps working from a suspended tenant (NFR-31).
5. The Administrator is told exactly what has changed, the amount, the date and the single action that restores service (UC-142 step 4; UX-54). The notice is non-suppressible (FR-163).
6. **A-11's *suspend* and *restore* are Billing Operator exceptions**, each needing a stated rationale (UX-125) and written to the billing ledger as an entitlement-override entry (FR-151) (182/92). They override the automatic path and do not replace it, and a manual suspension is told to the Administrator by the same statement of what changed and how to restore (5).

**Acceptance criteria.**
- **AC-1** Given dunning is exhausted, then the subscription state becomes suspended. *(source: FR text; UC-142)*
- **AC-2** Given a suspended subscription, then out-of-entitlement reports and entities are read-only and new exports are blocked. *(source: FR text; UC-142 step 2)*
- **AC-3** Given a suspended subscription, then previously generated documents and invoice history remain downloadable and no content was deleted. *(source: UC-142 step 3; D-13; FR-104)*
- **AC-4** Given suspension, then the Administrator is told what changed and how to restore service. *(source: FR text; UX-54)*
- **AC-5** Given a manual suspend or restore by the Operator, then a rationale is required and a ledger entry is written. *(source: §12.5.6 task-182 payment and fiscal row, 182/92)*

**History.**
- 5 Oct 2026 · project owner · A-11's suspend and restore are Operator exceptions with a rationale and a ledger entry; restoration is automatic · §12.5.6 task-182 payment and fiscal row (182/92)

### FR-137 — Restore on settlement, with no call to support

**Status.** Not started — remaining 65.5 (restore on settlement), 68.9

**Obligation.** The system shall restore full entitlements automatically on settlement of the overdue amount, without requiring the customer to contact support.

| | |
|---|---|
| **Actors** | SYS restores. |
| **Traces** | UC-143, UC-138, UC-105 · FR-97, FR-104, FR-132 · BR-COL-2 |
| **Surfaces** | A-11 (restore) · the tenant's restored screens |

**Preconditions.** A suspended subscription with an overdue amount (UC-143).

**Behaviour.**
1. On settlement of the overdue amount SYS restores full entitlements and read-only entities and reports return to editable (UC-143).
2. Restoration is automatic because the failure behind a suspension is usually an expired card, not a decision (UC-143 rule).
3. **Service is restored when no overdue amount remains**, by any route that settles the last of it: an automatic match (FR-132), a card payment, or a manual settlement (FR-134) (182/92). A partial settlement does not restore service, since *the overdue amount* is read as all of it. The Operator's manual restore is FR-136's exception and records its rationale.

**Acceptance criteria.**
- **AC-1** Given a suspended subscription, when the overdue amount is settled, then full entitlements are restored. *(source: FR text; UC-143)*
- **AC-2** Given restoration, then read-only entities and reports are editable again. *(source: FR text; UC-143 step 2)*
- **AC-3** Given restoration, then no support intervention was needed. *(source: FR text; BR-COL-2)*
- **AC-4** Given several overdue amounts, then a payment that settles only some of them does not restore service. *(source: §12.5.6 task-182 payment and fiscal row, 182/92)*
- **AC-5** Given the last overdue amount settled by a match, a card payment or a manual settlement, then service is restored. *(source: §12.5.6 task-182 payment and fiscal row, 182/92)*

**History.**
- 5 Oct 2026 · project owner · restoration is automatic when no overdue amount remains, by any settlement route; a partial settlement does not restore · §12.5.6 task-182 payment and fiscal row (182/92)

### FR-138 — Write off a debt, never the document

**Status.** Not started — remaining 65.5 (the write-off record), 68.9, 193 (the accountant's list), 194 (the list as configuration)

**Obligation.** The system shall record a write-off against the invoice with reason and accounting treatment, leaving the fiscal document in the ledger rather than deleting it.

| | |
|---|---|
| **Actors** | BO. |
| **Traces** | UC-144, UC-141, UC-163 · UX-125 · FR-151 · BR-COL-3 · entity *Write-off* |
| **Surfaces** | A-11 (write off with reason and accounting treatment) |

**Preconditions.** A debt judged uncollectible (UC-144).

**Behaviour.**
1. The Operator records the reason and the accounting treatment (UC-144).
2. The invoice is not deleted: it stays in the ledger with a write-off entry against it, since the fiscal document exists whether or not it was ever paid (UC-144 rule; BR-COL-3).
3. A rationale is required on a write-off (UX-125). The console offers no affordance that implies deletion (A-11).
4. The write-off is one of the ledger's event classes (FR-151).
5. **The treatments offered are a closed list supplied by the company's accountant**, held as configuration (182/103); no treatment is assumed, and a write-off cannot be recorded until the list exists. A write-off does not change the subscription, which stays in whatever state FR-136 gave it. A write-off is not edited: if the debt is later paid, the payment settles the invoice in the ordinary way (FR-132, FR-134) and the system writes the compensating ledger entry that supersedes it (FR-151).

**Acceptance criteria.**
- **AC-1** Given an uncollectible invoice, when written off, then the reason and accounting treatment are recorded. *(source: FR text; UC-144)*
- **AC-2** Given a written-off invoice, then it remains in the ledger with the write-off entry against it. *(source: FR text; BR-COL-3)*
- **AC-3** Given a write-off with no rationale, then it is refused. *(source: UX-125)*
- **AC-4** Given a write-off, then its accounting treatment is one of the configured list, and any other is refused. *(source: §12.5.6 task-182 payment and fiscal row, 182/103)* Unmet until 194.
- **AC-5** Given a write-off, then the subscription's state is unchanged by it. *(source: §12.5.6 task-182 payment and fiscal row, 182/103)*

**History.**
- 5 Oct 2026 · project owner · write-off treatments are a closed list the accountant supplies; a write-off leaves the subscription's state alone · §12.5.6 task-182 payment and fiscal row (182/103)

## 5. Refunds and disputes (index §3.26)

### FR-139 — Refund through the original rail, with a credit note

**Status.** Not started — remaining 66.1, 66.2, 68.10, 66.4 (the two permissions), 193 (whether MIA refunds to origin)

**Obligation.** The system shall issue full or partial refunds through the original rail where possible and by transfer where not, generating the corresponding credit note, with refund authority separated from invoice issuance authority.

| | |
|---|---|
| **Actors** | BO refunds. SYS generates the credit note. |
| **Traces** | UC-145, UC-133, UC-147 · AD-6 · T-5 · UX-125 · FR-125, FR-141, FR-151 · BR-COL-5 · entity *Refund* |
| **Surfaces** | A-14 (Exception queue: issue a full or partial refund; the generated credit note) |

**Preconditions.** A recorded payment to refund (UC-145).

**Behaviour.**
1. The Operator refunds the payment through the original rail where possible and by transfer where not, then the system generates the corresponding credit note (UC-145 steps 1, 2; FR-125).
2. A refund is full or partial (FR text; entity *Refund*).
3. **Refund authority is separated from invoice issuance authority**, so that no single account can both raise a charge and reverse it (UC-145 rule; BR-COL-5). The console makes the separation visible and does not only enforce it server-side (A-14). **The two authorities are two permissions on Billing Operator accounts, *issue corrections* and *refund*, and no account may hold both** (182/93). Under the role model of 182/3 a role is a set of permissions: no role may contain both, and an assignment that would give one account both through different roles is refused. The credit note a refund generates is the system's act and needs neither.
4. A rationale is required (UX-125).
5. Refund execution runs through the saga with compensation, over the outbox with an idempotency key; a dispatcher restart must not duplicate a refund (`architecture.md` §6.4's *Refunds* row; AD-6; T-5; task 66.1).
6. The refund is a ledger event (FR-151).
7. **A refund to origin goes through the rail's adapter where the adapter declares it can** (182/94): a card refund goes through the acquirer adapter. **A refund by transfer is made by the Billing Operator from the company's own bank, outside the platform**, and is recorded with its bank reference, because the platform executes no money movement (NFR-74; DR-7). The total refunded against a payment may not exceed the amount paid. The credit note is generated when the refund's completion is recorded. **Assumed:** a MIA payment is refunded by transfer; it refunds to origin only if its adapter declares it can, which is an external fact (193).

**Acceptance criteria.**
- **AC-1** Given a payment made on a rail that can refund, then the refund is routed to that rail. Otherwise it is made by transfer. *(source: FR text; UC-145)*
- **AC-2** Given a refund, then the corresponding credit note is generated under FR-125. *(source: FR text; UC-145 step 2)*
- **AC-3** Given an account holding only invoice issuance authority, then it cannot perform a refund. *(source: FR text; UC-145 rule)*
- **AC-4** Given a dispatcher restart during a refund, then no refund is executed twice. *(source: task 66.1; T-5)*
- **AC-5** Given a Billing Operator account, then it never holds both the *issue corrections* and the *refund* permissions, whether directly or through its roles. *(source: §12.5.6 task-182 payment and fiscal row, 182/93)* Unmet until 66.4.
- **AC-6** Given refunds against a payment, then their total never exceeds the amount paid. *(source: §12.5.6 task-182 payment and fiscal row, 182/94)*
- **AC-7** Given a refund by transfer, then it is recorded with its bank reference and the credit note is generated on the recorded completion. *(source: §12.5.6 task-182 payment and fiscal row, 182/94)*

**History.**
- 5 Oct 2026 · project owner · refund authority and invoice-issuance authority are two permissions that no account holds together · §12.5.6 task-182 payment and fiscal row (182/93)
- 5 Oct 2026 · project owner · card refunds go through the acquirer adapter; a transfer refund is made from the company's bank and recorded; the total is capped at the amount paid · §12.5.6 task-182 payment and fiscal row (182/94)

### FR-140 — Card chargebacks and the evidence pack

**Status.** Not started — remaining 66.3, 68.10, 193 (the acquirer's formats, outcomes and deadlines)

**Obligation.** The system shall handle a card chargeback by recording the case, assembling an evidence pack from the order, the recorded terms acceptance and usage records, and recording the outcome.

| | |
|---|---|
| **Actors** | BO. The acquirer runs the dispute. |
| **Traces** | UC-146, UC-113, UC-147 · FR-105, FR-111, FR-141 · entity *Chargeback case* |
| **Surfaces** | A-14 (chargeback cases with the evidence pack and outcome; assemble and submit evidence; record an outcome) |

**Preconditions.** A disputed card transaction (UC-146).

**Behaviour.**
1. On notification of a dispute the Operator records the case (UC-146 step 1).
2. The Operator assembles evidence from the order, the terms acceptance and the usage records (UC-146 step 2). The evidence is data the platform already holds, which is why FR-111 records the terms version, timestamp and acting user (UC-146 rule).
3. The Operator records the outcome (UC-146 step 3).
4. A chargeback arrives without a request, against a document that may already have been transmitted to e-Factura, so its fiscal correction takes the reissue path of FR-127 and is not a local reversal (task 66.3).
5. Entitlement reversal follows as its own step (FR-141).
6. **The evidence pack is a generated bundle the Operator downloads and submits through the acquirer's own channel** (182/104). It holds the order, the recorded terms acceptance (version, timestamp and acting user; FR-111) and the usage records (FR-105), identified by the acquirer's transaction reference. The platform submits nothing itself. The Operator enters the outcome, *won* or *lost*, by hand, and a case is recorded, evidence submitted, or decided. **A lost case triggers the fiscal correction of (4) and the entitlement step of FR-141.** **Assumed:** the acquirer's formats, outcome values and deadlines are its own and an external fact (193); if an acquirer offers a dispute API later, submission can be automated without changing the pack.

**Acceptance criteria.**
- **AC-1** Given a disputed card transaction, then a case is recorded. *(source: FR text; UC-146 step 1)*
- **AC-2** Given a case, then the evidence pack draws on the order, the FR-111 terms acceptance and the FR-105 usage records. *(source: FR text; UC-146 step 2)*
- **AC-3** Given a decision, then the outcome is recorded against the case. *(source: FR text; UC-146 step 3)*
- **AC-4** Given a case, then the evidence pack is a downloadable bundle of the order, the terms acceptance and the usage records, and the platform submits nothing to the acquirer. *(source: §12.5.6 task-182 payment and fiscal row, 182/104)*
- **AC-5** Given a lost case, then the fiscal correction takes FR-127's path and the entitlement step of FR-141 is available. *(source: §12.5.6 task-182 payment and fiscal row, 182/104)*

**History.**
- 5 Oct 2026 · project owner · the evidence pack is a bundle the Operator submits through the acquirer; the outcome is entered by hand; a lost case triggers the correction and FR-141 · §12.5.6 task-182 payment and fiscal row (182/104)

### FR-141 — Reverse entitlements as a step of their own

**Status.** Not started — remaining 66.1, 68.10

**Obligation.** The system shall reverse entitlements following a refund or chargeback as a step distinct from the financial reversal, applying read-only treatment rather than deletion and accommodating partial, goodwill and already-consumed cases.

| | |
|---|---|
| **Actors** | SYS adjusts the subscription. |
| **Traces** | UC-147, UC-145, UC-146, UC-151 · D-13 · NFR-59 · FR-103, FR-104 · BR-COL-6, BR-ENT-4 |
| **Surfaces** | A-14 (entitlement reversal applies read-only treatment) |

**Preconditions.** A financial reversal has occurred (UC-147).

**Behaviour.**
1. SYS adjusts the subscription to reflect the reversed payment and applies the same read-only treatment as suspension, not deletion (UC-147 steps 1, 2; FR-104).
2. It is a distinct step from the financial reversal, because a refund may be partial, goodwill, or for a period already consumed (UC-147 rule; BR-COL-6).
3. It can be invoked independently of the financial reversal (FR text).
4. Which content becomes read-only follows FR-103's rule (UC-147 related UC-151).
5. **The Billing Operator chooses at refund time among *no change* (goodwill), *read-only now* and *read-only from period close*,** and the choice is recorded with the refund (182/105). A lost chargeback takes the same choice. None of the three deletes anything (FR-104), and a refund cannot be completed without one.

**Acceptance criteria.**
- **AC-1** Given a refund or chargeback, then entitlement reversal can be invoked independently of the financial reversal. *(source: FR text; UC-147 rule)*
- **AC-2** Given a reversal, then read-only treatment applies per FR-104 and no content is deleted. *(source: FR text; UC-147 step 2)*
- **AC-3** Given a partial, a goodwill and an already-consumed case, then each is handled without deleting content. *(source: FR text; UC-147 rule)*
- **AC-4** Given a refund, then the Operator's choice among *no change*, *read-only now* and *read-only from period close* is required and is recorded with it. *(source: §12.5.6 task-182 payment and fiscal row, 182/105)*

**History.**
- 5 Oct 2026 · project owner · the Operator chooses the subscription's treatment at refund time among three, recorded with the refund · §12.5.6 task-182 payment and fiscal row (182/105)

## 6. Enterprise (index §3.27)

### FR-142 — Enterprise starts as a request, not a checkout

**Status.** Not started — remaining 70.1, 70.2, 70.3

**Obligation.** The system shall exclude Enterprise from self-serve checkout, with a quote request creating a tracked opportunity as the entry point to the contract path.

| | |
|---|---|
| **Actors** | OA requests. BO receives the opportunity. |
| **Traces** | UC-153 · D-12 · BR-SUB-7 |
| **Surfaces** | S-25 (Focus: entity count, user count, required capabilities; reached from S-17 and S-18) · A-15 |

**Behaviour.**
1. Enterprise never passes through self-serve checkout. The plan comparison exits to S-25, not S-19, for a plan that is not self-serve (D-12; S-18).
2. The Administrator describes entity count, user count and required capabilities; the request creates a **tracked opportunity**, not an email (UC-153).
3. The Billing Operator receives the opportunity and answers it with a quote (UC-153; UC-154). The quote reaches the Administrator by notification (S-25).
4. The screen shows *pending* while the quote is prepared (S-25).
5. **An opportunity is *requested*, *quoted* or *concluded*, and the Operator may *close* it without a contract, with a stated reason** (182/95). Its fields are the three the Administrator describes (entity count, user count and required capabilities) with the requesting organization and the instant of the request. *Concluded* means a contract was recorded against its quote (FR-143).

**Acceptance criteria.**
- **AC-1** Given the system, then no self-serve checkout path exists for Enterprise. *(source: FR text; D-12)*
- **AC-2** Given a quote request, then a tracked opportunity is created rather than an email sent. *(source: FR text; UC-153)*
- **AC-3** Given a plan that is not self-serve, then the plan comparison leads to S-25. *(source: design_spec S-18)*

**History.**
- 5 Oct 2026 · project owner · the Advisor plan is not an Enterprise-shaped plan: it is a catalogue plan bought at self-serve checkout, so this requirement's rationale no longer lists the Advisor model among those that pass through the contract path · §12.5.6 task-182 advisor row (182/150)

**History.**
- 5 Oct 2026 · project owner · an opportunity is requested, quoted or concluded, and may be closed by the Operator with a reason · §12.5.6 task-182 payment and fiscal row (182/95)

### FR-143 — A quote is structured data

**Status.** Not started — remaining 70.5 (the api), 70.3

**Obligation.** The system shall hold a quote as structured data — negotiated entitlement set, price, currency, billing schedule, validity date — provisioning directly on acceptance so that sold terms and configured terms cannot drift apart.

| | |
|---|---|
| **Actors** | BO prepares and issues. |
| **Traces** | UC-154, UC-153, UC-155, UC-156 · D-12 · entity *Quote* |
| **Surfaces** | A-15 (Record: an accepted quote is read-only) |

**Preconditions.** A tracked opportunity (UC-154).

**Behaviour.**
1. The Operator builds a quote against a negotiated entitlement set, price, currency and billing schedule, and issues it with a validity date (UC-154).
2. The quote is structured data and not a document, so an accepted quote provisions directly and sold terms and configured terms cannot drift apart (UC-154 rule).
3. An accepted quote is read-only (A-15 states).
4. **Acceptance is the Billing Operator recording the executed contract (FR-144) against the quote** (182/95); no tenant screen accepts a quote. The quote then becomes read-only, and the subscription is provisioned from the contract, pre-filled from the quote, so there is one provisioning path. A quote is *draft*, *issued*, *accepted* or *expired*: once its validity date passes unaccepted it is *expired*, read-only, and no contract can be recorded against it; new terms need a revised quote (task 70.3).

**Acceptance criteria.**
- **AC-1** Given a quote, then each of its named attributes is stored as data. *(source: FR text; UC-154)*
- **AC-2** Given an accepted quote, then the contract recorded against it is pre-filled from it and the subscription is provisioned from that contract without re-entry. *(source: FR text; UC-154 rule; §12.5.6 task-182 payment and fiscal row, 182/95)*
- **AC-3** Given an accepted quote, then it can no longer be edited. *(source: A-15 states)*
- **AC-4** Given a quote past its validity date and not accepted, then it is expired and no contract can be recorded against it. *(source: §12.5.6 task-182 payment and fiscal row, 182/95)*

**History.**
- 5 Oct 2026 · project owner · acceptance is the Operator recording the executed contract against the quote; one provisioning path; a lapsed quote expires · §12.5.6 task-182 payment and fiscal row (182/95)

### FR-144 — The executed contract is the record

**Status.** Not started — remaining 70.5 (the api), 70.4

**Obligation.** The system shall record the executed contract: term length, notice period, negotiated entitlements, SLA, price protection and any non-standard clause with billing consequences.

| | |
|---|---|
| **Actors** | BO records. |
| **Traces** | UC-155, UC-154, UC-156, UC-158, UC-159 · D-12 · NFR-97 (deferred) · entity *Contract* |
| **Surfaces** | A-15 (Record: an executed contract is read-only) |

**Preconditions.** An executed agreement exists (UC-155).

**Behaviour.**
1. The Operator records term length, notice period, negotiated entitlements, SLA, price protection, and any non-standard clause with billing consequences (UC-155).
2. This is the authoritative record the Enterprise subscription is provisioned from (UC-155 rule).
3. The subscription's entitlements are traceable to the contract (FR text).
4. An executed contract is read-only (A-15 states).
5. **Structured fields are held only where billing acts on them: the term, the notice period, and the price-protection cap and its period** (182/106). The SLA and any non-standard clause are text with an attached document, because nothing computes on them. **Negotiated entitlement overrides apply for the contract term** and end with it, when the lapse path of FR-147 takes over; no separate validity date is held on an override, and one is additive if a ramp-up is ever sold. The purchase-order reference is FR-146's.

**Boundaries.** The measurement record behind an availability commitment and any service credits is deferred NFR-97. The commitment itself is a commercial document (`non_functional_requirements.md` §1.3; NFR-97).

**Acceptance criteria.**
- **AC-1** Given a contract, then each named term is recorded against it. *(source: FR text; UC-155)*
- **AC-2** Given an Enterprise subscription, then its entitlements are traceable to the contract. *(source: FR text; UC-155 rule)*
- **AC-3** Given a contract, then its term, notice period and price-protection cap and period are structured fields, and its SLA and non-standard clauses are text with an attached document. *(source: §12.5.6 task-182 payment and fiscal row, 182/106)*

**History.**
- 5 Oct 2026 · project owner · contract terms are structured only where billing acts on them; overrides last for the term · §12.5.6 task-182 payment and fiscal row (182/106)

### FR-145 — Overrides on the subscription, never a plan per customer

**Status.** Not started — remaining 70.5 (the api), 70.4

**Obligation.** The system shall provision an Enterprise subscription by additive per-subscription entitlement overrides rather than a bespoke plan per customer.

| | |
|---|---|
| **Actors** | BO activates the subscription. |
| **Traces** | UC-156, UC-155 · D-12 · AD-5 · FR-92, FR-151 · BR-SUB-7 · entity *Entitlement override* (held in part 6) |
| **Surfaces** | A-15 (the additive overrides; "structurally impossible to bypass") |

**Preconditions.** A recorded contract (UC-156).

**Behaviour.**
1. The Operator activates the subscription with the contract's negotiated entitlements, which override the standard plan's quotas per organization (UC-156).
2. Overrides are additive data on the subscription and not a bespoke plan, which stops the plan catalogue from degenerating into one plan per client (UC-156 rule).
3. An organization's entitlements are the plan version's plus the subscription's overrides (AD-5). The editor makes a bespoke plan structurally impossible (A-15).
4. Entitlements change on invoice issuance under approved transfer terms, never on order creation (FR-92); approved terms are a property of this contract (182/81). An entitlement override is a ledger event (FR-151).

**Acceptance criteria.**
- **AC-1** Given a contract's negotiated entitlements, then they are stored as overrides on the subscription. *(source: FR text; UC-156)*
- **AC-2** Given an Enterprise provisioning, then no new plan record is created for the customer. *(source: FR text; UC-156 rule)*
- **AC-3** Given an override, then an entry is written to the billing ledger. *(source: UC-163 event classes; FR-151)*

### FR-146 — The customer's purchase-order reference on every invoice

**Status.** Not started — remaining 70.5 (the reference record), 70.4

**Obligation.** The system shall record the customer's own purchase-order or contract reference against the subscription and reproduce it on every invoice issued under it.

| | |
|---|---|
| **Actors** | OA records it. |
| **Traces** | UC-157, UC-127, UC-155 · D-10 · FR-125 · entity *Purchase-order reference* |
| **Surfaces** | S-22 (record a purchase-order reference; format validation on that field only) · A-15 |

**Preconditions.** A subscription exists (UC-157).

**Behaviour.**
1. The Administrator records the reference against the subscription, and it is reproduced on every invoice issued under it (UC-157 steps 1, 2). Institutional and public-sector buyers will not process an invoice that omits it (UC-157 rule).
2. The reference is shown on the invoices in S-22 (S-22).
3. An issued invoice is immutable, so a reference recorded or changed later appears on invoices issued after that point (D-10; FR-125).
4. **The reference is length-bounded text, validated for length only** (182/106). The bound is 64 characters, a routine value to be reconciled with the e-Factura specification's buyer-reference field when 55.4 records it.

**Acceptance criteria.**
- **AC-1** Given a subscription, when the Administrator records a purchase-order reference, then it is stored against the subscription. *(source: FR text; UC-157 step 1)*
- **AC-2** Given the reference, then every invoice issued under that subscription shows it. *(source: FR text; UC-157 step 2)*
- **AC-3** Given an invoice issued before the reference was recorded, then it is unchanged. *(source: D-10; FR-125)*
- **AC-4** Given a reference longer than the bound, then it is refused, and any shorter text is accepted. *(source: §12.5.6 task-182 payment and fiscal row, 182/106)*

**History.**
- 5 Oct 2026 · project owner · the purchase-order reference is length-bounded text · §12.5.6 task-182 payment and fiscal row (182/106)

### FR-147 — Custom billing schedules and the contract's end

**Status.** Not started — remaining 70.5 (the api), 70.4, 194 (the expiry lead time)

**Obligation.** The system shall drive custom billing schedules from data — annual in advance, semi-annual, milestone-based, multi-year instalment — and shall track approaching expiry, renewal and renegotiation, with an unrenewed contract following the standard lapse path rather than abrupt termination.

| | |
|---|---|
| **Actors** | BO schedules and tracks. SYS issues on schedule. |
| **Traces** | UC-158, UC-159, UC-155 · D-13 · FR-104, FR-92 · entity *Billing schedule*, *Contract* |
| **Surfaces** | A-15 (custom billing schedule; approaching expiry and renewal state) |

**Preconditions.** A recorded contract with a billing schedule (UC-158). A contract approaching expiry (UC-159).

**Behaviour.**
1. Invoicing is scheduled to match the contract: annual in advance, semi-annual, milestone-based, or multi-year with an annual instalment. The scheduler is data-driven, because the alternative is a manual diary entry that will eventually be missed (UC-158).
2. The Operator tracks approaching expiry, initiates renewal within the notice period, and records renewal, renegotiation or expiry (UC-159).
3. A contract that expires without renewal follows the standard lapse path, with nothing deleted, rather than terminating abruptly (UC-159; D-13; FR-104). The interface states that (A-15).
4. **A schedule is a list of dated billing points on the contract** (182/107): annual in advance, semi-annual and multi-year instalment are points, each with an issue date and a due date. **A milestone point has no date** and is released by the Billing Operator in A-15 with a stated rationale. A point that falls due or is released issues the fiscal invoice before payment, under the contract's approved terms (182/81), and the due date it carries is what dunning attaches to (FR-135; 182/91). **Approaching expiry is surfaced in the Billing Operator's queue at a configured lead time before the notice date**; the lead time is set by the project owner and no value is assumed here.

**Acceptance criteria.**
- **AC-1** Given each of the four schedule shapes, then it can be configured as data. *(source: FR text; UC-158)*
- **AC-2** Given a contract nearing its expiry or notice date, then the approach is tracked and surfaced. *(source: FR text; UC-159)*
- **AC-3** Given a contract that expires unrenewed, then the subscription lapses per FR-104 and is not terminated abruptly. *(source: FR text; UC-159 alternate flow)*
- **AC-4** Given a milestone point, then it carries no date and is released only by an Operator action with a rationale. *(source: §12.5.6 task-182 payment and fiscal row, 182/107)*
- **AC-5** Given a contract, then its approaching expiry appears in the Operator's queue at the configured lead time before the notice date. *(source: §12.5.6 task-182 payment and fiscal row, 182/107)* Unmet until 194.

**History.**
- 5 Oct 2026 · project owner · a schedule is a list of dated billing points; a milestone is undated and released by the Operator; expiry is surfaced at a configured lead time · §12.5.6 task-182 payment and fiscal row (182/107)

## 7. Financial reporting (index §3.28)

### FR-148 — VAT rates and rules as effective-dated data

**Status.** Not started — remaining 61.4, 68.11

**Obligation.** The system shall maintain VAT rates and the rules selecting treatment by customer residency and VAT status, each with an effective date, requiring no deployment for a rate change.

| | |
|---|---|
| **Actors** | BO maintains. SYS applies (FR-124). |
| **Traces** | UC-160, UC-128 · AD-4 · NFR-34, NFR-73 · FR-124 · BR-INV-4 · entity *VAT rate and rule* |
| **Surfaces** | A-16 (maintain VAT rates and rules) |

**Behaviour.**
1. The Operator maintains the applicable VAT rates and the rules selecting treatment by residency and VAT status, each with an effective date (UC-160).
2. A change is a data change with a date, and the date is a calendar date, not an instant (task 61.4; NFR-34). It needs no deployment (NFR-73; AD-4).
3. FR-124 applies the rate and rule in force for the document's date. A document dated before a rule's effective date keeps the prior rate (FR text; NFR-73's *effective-dating verified against historic documents*).
4. The interface states that a rate change is effective-dated and needs no deployment (A-16; UX-126).
5. The `vat_rule` artefact carries the three treatments of FR-124 (domestic supply, export, reverse charge), each with its rate, its selection rule over the legal-address country and the VAT registration code, and its basis wording key (182/85).

**Configuration-held values.** The standard Moldovan rate is recorded at 20% (`use_cases.md` §6.2). No artefact is seeded (`config/seed/README.md`: *VAT rules (61)*).

**Acceptance criteria.**
- **AC-1** Given a rate or rule added with an effective date, then FR-124 applies it from that date with no deployment. *(source: FR text; NFR-73)*
- **AC-2** Given a document dated before the effective date, then it retains the prior rate. *(source: FR text; NFR-73)*
- **AC-3** Given the artefact, then it holds a domestic, an export and a reverse-charge row, each with its rate, selection rule and basis wording. *(source: §12.5.6 task-182 payment and fiscal row, 182/85)* Unmet until 61.4.

### FR-149 — The billing revenue dashboard

**Status.** Not started — remaining 61.7 (the measures), 68.11, 193 (the accountant's definitions)

**Obligation.** The system shall provide a billing revenue dashboard covering recognised and deferred revenue, active subscriptions by plan, monthly recurring revenue, churn, collection rate and days sales outstanding.

| | |
|---|---|
| **Actors** | BO. |
| **Traces** | UC-161, UC-83, UC-84 · D-14 · FR-83 |
| **Surfaces** | A-16 (Dashboard: figures with confidence marking, period filter, export) |

**Preconditions.** Billing activity exists (UC-161).

**Behaviour.**
1. The Operator views recognised and deferred revenue, active subscriptions by plan, MRR, churn, collection rate and DSO (UC-161).
2. Read alongside the adoption metrics (FR-83), it makes the Phase 2 monetization decision evidence-based (UC-161 rule).
3. The figures reconcile with the ledger and are not recomputed beside it, because a second computation is a second answer (task 68.12).
4. The ledger currency is MDL (D-14).
5. **The company's accountant supplies the definitions** (182/108), and no definition binds the build until they do. The starting draft is: revenue is recognised straight-line over the service period; MRR is the annual price divided by twelve; churn is subscriptions lapsed or cancelled in the period divided by those active at its start; collection rate is the amount collected divided by the amount invoiced; DSO is receivables divided by revenue, times the days in the period. **The measures are seven**: recognised revenue, deferred revenue, active subscriptions by plan, MRR, churn, collection rate and DSO.

**Acceptance criteria.**
- **AC-1** Given billing activity, then the dashboard presents recognised and deferred revenue, active subscriptions by plan, MRR, churn, collection rate and DSO, each as the accountant defines it. *(source: FR text; UC-161; §12.5.6 task-182 payment and fiscal row, 182/108)* Unmet until 193.
- **AC-2** Given the dashboard, then its figures reconcile with the billing ledger. *(source: task 68.12)*

**History.**
- 5 Oct 2026 · project owner · the accountant supplies the definitions of the seven measures; the starting draft is recorded; the index criterion's count of six is corrected to seven · §12.5.6 task-182 payment and fiscal row (182/108)

### FR-150 — The revenue and VAT export

**Status.** Not started — remaining 61.7 (the export), 68.11, 193 (what the return needs)

**Obligation.** The system shall export the period's invoices, credit notes, payments and VAT summary in the form the fiscal return and the company's accountant require, including MDL equivalents of foreign-currency documents.

| | |
|---|---|
| **Actors** | BO exports. The accountant consumes it. |
| **Traces** | UC-162, UC-136, UC-160 · D-14 · FR-129 · BR-INV-5 |
| **Surfaces** | A-16 (export the revenue and VAT report) |

**Preconditions.** A closed period with invoices, credit notes and payments (UC-162).

**Behaviour.**
1. Triggered at period end or when preparing the quarterly VAT return (UC-162). VAT returns are quarterly, due by the 25th of the following month (`use_cases.md` §6.2).
2. The Operator extracts the period's invoices, credit notes, payments and VAT summary, with the MDL equivalents of foreign-currency documents taken from the stored rate (UC-162; FR-129).
3. It is the handover point to the company's own accounting. The platform does not replace the accounting system and keeps no double-entry books (UC-162 rule; index §8).
4. **The export is one file per document set (invoices, credit notes, payments) plus a VAT summary, for a period the Operator chooses**, each carrying MDL equivalents (182/109). The file format, CSV or XLSX, is fixed when the company's accountant states what the return needs (193). **A period is closed when its end date has passed and nothing paid in it is awaiting invoicing.**

**Acceptance criteria.**
- **AC-1** Given a closed period, then the export contains its invoices, credit notes, payments and VAT summary. *(source: FR text; UC-162)*
- **AC-2** Given a foreign-currency document, then the export carries its MDL equivalent from the stored rate. *(source: FR text; FR-129)*
- **AC-3** Given a period whose end has not passed, or in which a paid order is awaiting its invoice, then it is not closed and the export is not offered for it. *(source: §12.5.6 task-182 payment and fiscal row, 182/109)*

**History.**
- 5 Oct 2026 · project owner · the export is one file per document set plus a VAT summary; a period is closed when it has ended and nothing paid in it awaits invoicing · §12.5.6 task-182 payment and fiscal row (182/109)

### FR-151 — The append-only billing audit ledger

**Status.** Not started — remaining 61.3, 68.12

**Obligation.** The system shall maintain an append-only billing audit ledger of every financial event — order, invoice, payment, credit note, refund, manual match, write-off, entitlement override, price change — attributed and timestamped, with entries superseded rather than edited or deleted.

| | |
|---|---|
| **Actors** | SYS writes the entries. BO reviews. |
| **Traces** | UC-163, UC-133, UC-140, UC-144, UC-145, UC-156 · D-10 · DR-6 · NFR-33 · UX-126 · BR-LED-1, BR-COL-4 · entity *Billing audit ledger entry* |
| **Surfaces** | A-16 (Index: append-only, read-only) |

**Preconditions.** Financial events have been recorded (UC-163).

**Behaviour.**
1. The ledger records nine event classes — order, invoice, payment, credit note, refund, manual match, write-off, entitlement override, price change — each attributed to an actor and timestamped (UC-163).
2. **Entries are superseded, never edited or deleted.** A correction is a new entry referencing the original (`architecture.md` §7.7; BR-LED-1).
3. The guarantee is at database privilege level, in three layers — privilege, row-level security, and triggers including a `TRUNCATE` trigger — and an attempted mutation fails at the store (`architecture.md` §7.7; NFR-33). Each table's partitions are covered explicitly (task 61.3).
4. The table is `audit.ledger_entry`. Entries are retained for six years (`architecture.md` §9.2, §12.5.7).
5. The console presents the ledger as append-only and offers no affordance that implies otherwise (UX-126).
6. **Each entry is written by the use case that causes the event, in that use case's own transaction** (182/110): order (UC-110), invoice (UC-127), payment (UC-116, UC-120, UC-121, UC-138), credit note (UC-133), refund (UC-145), manual match (UC-139, UC-140), write-off (UC-144), entitlement override (UC-156, and the Operator's manual suspend or restore under 182/92) and price change (UC-91). An entry holds its event class, actor, timestamp, subject reference and amount in minor units. **The system writes a superseding entry when a compensating event occurs**, referencing the original; the console offers the Operator no action to supersede, and *attributed* is met by the originating actor.

**Acceptance criteria.**
- **AC-1** Given each of the nine event classes, then an entry is recorded with actor and timestamp. *(source: FR text; UC-163)*
- **AC-2** Given the ledger, then no path edits or deletes an entry, and an attempted mutation fails at the store. *(source: FR text; NFR-33)*
- **AC-3** Given a correction, then it appears as a superseding entry referencing the original. *(source: FR text; `architecture.md` §7.7)*
- **AC-4** Given an entry, then it holds its event class, actor, timestamp, subject reference and amount in minor units. *(source: §12.5.6 task-182 payment and fiscal row, 182/110)*
- **AC-5** Given the console, then no action lets the Operator supersede an entry, and a superseding entry is written only by the system on a compensating event. *(source: §12.5.6 task-182 payment and fiscal row, 182/110)*

**History.**
- 5 Oct 2026 · project owner · entries are written by their originating use case; the system writes the superseding entry; no Operator supersede action · §12.5.6 task-182 payment and fiscal row (182/110)

### FR-152 — Reconcile provider settlement against recorded payments

**Status.** Not started — remaining 61.7 (the settlement import), 68.12, 193 (the first real reports), 194 (tolerances)

**Obligation.** The system shall reconcile acquirer and instant-rail settlement reports against payments recorded in the platform, identifying missing settlements, fee discrepancies and timing differences.

| | |
|---|---|
| **Actors** | BO. |
| **Traces** | UC-164, UC-116, UC-120, UC-146 · NFR-91 · entity *Settlement report reconciliation* |
| **Surfaces** | A-16 (Index: settlement reports reconciled against recorded payments) |

**Preconditions.** Settlement reports are available from the acquirer and the instant rail (UC-164).

**Behaviour.**
1. On receipt of a settlement report the Operator reconciles it against the payments recorded in the platform and identifies missing settlements, fee discrepancies and timing differences (UC-164).
2. Without this the platform knows what it charged but not what it received, and the two differ routinely (UC-164 rule).
3. Unreconciled settlements beyond tolerance raise an operational alert; the tolerance is operational configuration, unquantified in the source (NFR-91).
4. This is distinct from FR-131, which brings in the customer-paid transfer statement.
5. **Each rail adapter parses its provider's settlement report into one common line shape**, and a line is matched to a recorded payment on the acquirer's transaction reference (182/111). A recorded payment with no line is a *missing settlement*; a matched line whose fee differs from the provider's agreed fee beyond the tolerance is a *fee discrepancy*; a line outside the timing window is a *timing difference*. The tolerance, the window and the agreed fee are configuration, set once the first real report from each provider has been seen (193); none is assumed here. Beyond tolerance an operational alert is raised (NFR-91).

**Acceptance criteria.**
- **AC-1** Given an imported settlement report, then missing settlements, fee discrepancies and timing differences are identified against recorded payments. *(source: FR text; UC-164)*
- **AC-2** Given a provider's report, then its adapter yields the common line shape and a line is matched on the acquirer's transaction reference. *(source: §12.5.6 task-182 payment and fiscal row, 182/111)*
- **AC-3** Given a difference beyond the configured tolerance, then an operational alert is raised. *(source: §12.5.6 task-182 payment and fiscal row, 182/111; NFR-91)* Unmet until 194.

**History.**
- 5 Oct 2026 · project owner · settlement reports are parsed by each adapter to a common line shape and matched on the transaction reference; tolerances are configuration · §12.5.6 task-182 payment and fiscal row (182/111)

## 8. Business rules held in this part

Moved from the index's §4.3 on 5 Oct 2026 (task 182), with their identifiers unchanged. A rule is not an additional requirement: it is a rule carried inside the requirement(s) it names, gathered here so the decision logic can be read in one place. Where a rule and its requirement differ, the requirement is the authority.

| Rule | Statement | Held in |
|---|---|---|
| BR-PAY-1 | All money movement is performed by licensed third parties behind a provider adapter; order routing is rail-agnostic and the customer chooses at checkout. | FR-114, D-7, D-8 |
| BR-PAY-2 | The platform receives, stores and transmits no card data; only the acquirer transaction reference and a masked descriptor are retained. | FR-115, D-7 |
| BR-PAY-3 | MIA is offered only where the order total is within the per-transaction ceiling, which is read from configuration. The source records the ceiling at approximately 5,000 MDL per transaction, commission-free below 10,000 MDL per month. | FR-118, FR-110, D-8 |
| BR-PAY-4 | Bank transfer carries no amount ceiling and defers provisioning until reconciliation. | FR-119, FR-132 |
| BR-PAY-5 | Recurring consent is recorded separately from the payment; removing the last instrument on an auto-renewing subscription warns that renewal will fail. | FR-117 |
| BR-PAY-6 | A recurring charge is idempotent per renewal period. Soft declines retry on a defined schedule; hard declines are never retried. | FR-120 |
| BR-PAY-7 | An excluded payment rail is shown with its exclusion reason rather than hidden. | FR-110 |
| BR-INV-1 | Invoice numbers are gapless and monotonic per document type per fiscal year, allocated under a lock at issuance and never reserved at order creation. | FR-123, D-10 |
| BR-INV-2 | An issued invoice is immutable; its effect changes only through a credit note or corrective invoice referencing it, itself transmitted to e-Factura. | FR-125, D-10 |
| BR-INV-3 | A proforma is not a fiscal document: it creates no VAT liability, consumes no invoice number, and is voidable with its order. | FR-121, FR-113 |
| BR-INV-4 | VAT treatment derives from customer residency and VAT status, with the basis stated on the document and rates drawn from effective-dated data. The source records the standard Moldovan rate at 20% with no reduced rate for digital services. | FR-124, FR-148 |
| BR-INV-5 | A foreign-currency invoice stores and reproduces the BNM official rate for the invoice date; MDL is the ledger currency. | FR-129, FR-150, D-14 |
| BR-INV-6 | Every invoice is rendered into the national e-Factura XML format and transmitted; an untransmitted invoice is never marked delivered. | FR-126, FR-127, D-9 |
| BR-INV-7 | Issued fiscal documents and their transmission receipts are retained in immutable storage for the statutory period, which takes precedence over a customer erasure request. The source records Moldovan VAT record retention at not less than six years. | FR-130 |
| BR-INV-8 | Invoice history and document download remain available after downgrade, cancellation and lapse. | FR-128, FR-104 |
| BR-COL-1 | Dunning escalates at configured intervals, each notice stating amount, due date passed and restriction date, and stops immediately on payment. | FR-135 |
| BR-COL-2 | Settlement of the overdue amount restores full entitlements automatically, without contacting support. | FR-137 |
| BR-COL-3 | A write-off leaves the fiscal document in the ledger with the write-off recorded against it. | FR-138 |
| BR-COL-4 | Manual settlement of an invoice requires a stated reason and writes to the immutable billing audit ledger. | FR-134, FR-151 |
| BR-COL-5 | Refund authority is separated from invoice issuance authority. | FR-139 |
| BR-COL-6 | Entitlement reversal is a step distinct from financial reversal and applies read-only treatment, never deletion. | FR-141 |
| BR-LED-1 | Billing audit ledger entries are superseded, never edited or deleted. | FR-151 |

## 9. Entities held in this part

Moved from the index's §5.4 on 5 Oct 2026 (task 182). These rows list the attributes the requirements name. They are not a data model.

| Entity | Attributes named by requirements | Requirements |
|---|---|---|
| Payment | Rail, acquirer transaction reference, masked descriptor, outcome | FR-114, FR-115, FR-116 |
| Stored payment instrument | Card token held by acquirer, recurring consent record, default flag | FR-117 |
| Proforma invoice | Payment reference, bank details, amount, validity date, void state | FR-121, FR-113 |
| Fiscal invoice | Number from series, supplier and buyer fiscal identifiers, service description, net, VAT rate and amount, total, immutable | FR-122, FR-123, FR-125 |
| Credit note / corrective invoice | Reference to original invoice | FR-125, FR-139 |
| Numbering series | Document type (fiscal invoice, credit note, corrective invoice), series code, fiscal year, gapless monotonic sequence | FR-123 |
| e-Factura transmission record | XML artefact, acknowledgement, platform identifier, rejection reason | FR-126, FR-127 |
| Exchange rate record | BNM official rate for the invoice date | FR-129 |
| Fiscal document archive | Documents and transmission receipts, immutable, statutory retention period | FR-130 |
| Bank statement import | Source (file; bank API later), statement lines each identified by bank reference, date and amount | FR-131 |
| Reconciliation match / exception | Matched proforma, invoice and order, exception class, resolution (one of four), owner, rationale | FR-132, FR-133 |
| Dunning state | Sequence position, intervals, stop-on-payment | FR-135 |
| Write-off | Reason, accounting treatment (one of a configured list) | FR-138 |
| Refund | Full or partial, rail, bank reference for a transfer, associated credit note, subscription treatment chosen | FR-139, FR-141 |
| Chargeback case | Case record, evidence pack, outcome (won or lost) | FR-140 |
| Quote | Negotiated entitlement set, price, currency, billing schedule, validity date | FR-143 |
| Contract | Term length, notice period, negotiated entitlements, SLA, price protection, non-standard clauses | FR-144, FR-147 |
| Purchase-order reference | Customer PO or contract reference on subscription and invoices | FR-146 |
| Billing schedule | Dated billing points with issue date and due date; an undated milestone point released by the Operator | FR-147 |
| VAT rate and rule | Rate, selection rule by residency and VAT status, effective date | FR-148 |
| Billing audit ledger entry | Event class, actor, timestamp, subject reference, amount in minor units, superseding entry | FR-151 |
| Settlement report reconciliation | Acquirer and instant-rail settlements, missing settlements, fee discrepancies, timing differences | FR-152 |
