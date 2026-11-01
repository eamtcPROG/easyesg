import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The notification store — the record and its deliveries (task 50.1.1; §12.5.6's task-50.1 row; FR-160, FR-167,
 * FR-168, FR-170).
 *
 * **A sixth domain schema, `notification`** (row (2), §7.1 amended), owned by `platform/notification`. One notice
 * is one `notification.notification` row however many people and channels it reaches, and each person reached on
 * each channel is one `notification.delivery` row — FR-160's *one record, N deliveries*, and FR-170's evidence.
 *
 * Four things about it are the decision rather than an implementation of it:
 *
 * - **Organization and account are referenced by id, unenforced.** §7.1 permits one cross-schema foreign key and it
 *   is not these, and NFR-109 keeps delivery evidence a year past the organization it was sent for — a cascade from
 *   `core.organization` would erase the evidence at the moment it is most likely to be asked for. `field_change`'s
 *   `actor_id` is the precedent for the account. Within the schema, a delivery references its notice by
 *   `(id, organization_id)`, §7.3's composite key, so a delivery's tenant is tied to its notice's, not copied.
 * - **FR-167's deduplication is a partial unique index**, over `(organization, category, subject, recipient
 *   scope)` for every notice not cancelled (row (6)). A raise that meets an open notice for the same key is folded
 *   into it — `INSERT … ON CONFLICT … DO NOTHING` against this index — and a cancelled one no longer holds the key,
 *   so the next raise opens a new notice. The database, not a read-then-write, is what makes two concurrent raises
 *   one notice.
 * - **Read and dismissed belong to the delivery, never to the notice** (row (4), FR-161, BR-NOT-5): one recipient
 *   reading an organization-wide notice clears it for nobody else. They exist on in-app rows only; an email is not
 *   read in this product's sense.
 * - **Only the worker writes here in this task** (row (3)): the record is written from the raised event, so no
 *   producer's transaction touches this schema. `esg_app` is granted nothing — task 50.1.2's centre brings its
 *   read and its read-state write, with the policies they need, in its own migration. `esg_worker` gets what the
 *   dispatch does and no more: it opens a notice, marks it delivered, and inserts deliveries; nothing updates a
 *   delivery until 51.4 records a bounce.
 *
 * **Row security is enabled and forced on both, with policies `TO PUBLIC`** — task 12's reasoning: a role added
 * later is filtered by default. The worker binds `app.current_org` from the job, as §7.6 has it; `esg_admin_ro`
 * reads across organizations with `BYPASSRLS`, as it does every other tenant table.
 *
 * **No field-change capture** — `schema-invariants.e2e-spec.ts` classifies both tables with the reason: the record
 * is written by the system, and a read marker records presence, not a changed value.
 */
export class NotificationStore1790467200000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA notification`);
    // USAGE only, the baseline's rule: every table privilege is granted per table below.
    await queryRunner.query(`GRANT USAGE ON SCHEMA notification TO esg_app, esg_worker, esg_admin_ro`);

    // ── FR-160: the notice ───────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE notification.notification (
        -- The outbox row's key, which raise() answered and the record adopts (§12.5.6's task-49.3 row (3)) — so
        -- no default: an id minted here would be a second name for the same notice.
        id              uuid        PRIMARY KEY,
        organization_id uuid        NOT NULL,
        category_key    text        NOT NULL,
        subject_ref     text        NOT NULL,
        recipient_scope text        NOT NULL,
        deep_link       text        NOT NULL,
        params          jsonb       NOT NULL DEFAULT '{}',
        state           text        NOT NULL DEFAULT 'raised',
        raised_at       timestamptz NOT NULL DEFAULT now(),
        delivered_at    timestamptz,
        cancelled_at    timestamptz,

        CONSTRAINT notification_state_known CHECK (state IN ('raised', 'delivered', 'cancelled')),
        -- A notice cancelled before its dispatch finished was never delivered, and one cancelled after keeps the
        -- instant it was — so delivered_at pairs with the state everywhere except a cancelled notice.
        CONSTRAINT notification_cancelled_at_matches_state CHECK ((state = 'cancelled') = (cancelled_at IS NOT NULL)),
        CONSTRAINT notification_delivered_at_matches_state
          CHECK (state = 'cancelled' OR (state = 'delivered') = (delivered_at IS NOT NULL)),

        -- Keys, not sentences: the category's wording is the catalogue's (OQ-43).
        CONSTRAINT notification_category_key CHECK (category_key ~ '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$'),
        CONSTRAINT notification_subject_ref_present CHECK (length(subject_ref) > 0),
        CONSTRAINT notification_recipient_scope_present CHECK (length(recipient_scope) > 0),
        -- FR-162: a path inside apps/web; the worker makes it absolute per recipient's locale.
        CONSTRAINT notification_deep_link_is_path CHECK (deep_link LIKE '/%'),
        CONSTRAINT notification_params_object CHECK (jsonb_typeof(params) = 'object'),

        -- §7.3's composite-FK target: a delivery ties its tenant to this row's.
        CONSTRAINT notification_id_organization_key UNIQUE (id, organization_id)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX notification_open_key
        ON notification.notification (organization_id, category_key, subject_ref, recipient_scope)
        WHERE state <> 'cancelled'
    `);

    // ── FR-170: each recipient reached, on each channel ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE notification.delivery (
        id                   uuid        PRIMARY KEY DEFAULT uuidv7(),
        notification_id      uuid        NOT NULL,
        organization_id      uuid        NOT NULL,
        recipient_account_id uuid        NOT NULL,
        channel              text        NOT NULL,
        outcome              text        NOT NULL,
        dispatched_at        timestamptz NOT NULL DEFAULT now(),
        read_at              timestamptz,
        dismissed_at         timestamptz,

        CONSTRAINT delivery_notification_fkey FOREIGN KEY (notification_id, organization_id)
          REFERENCES notification.notification (id, organization_id) ON DELETE CASCADE,
        -- One delivery per person per channel per notice: a redelivered job, or a raise folded into an open notice,
        -- reaches nobody twice.
        CONSTRAINT delivery_once UNIQUE (notification_id, recipient_account_id, channel),

        CONSTRAINT delivery_channel_known CHECK (channel IN ('in_app', 'email')),
        -- in_app: written to the recipient's centre, which is the delivery (FR-168). email: the provider accepted
        -- the message (row (7)); 51.4 adds what the provider reports afterwards.
        CONSTRAINT delivery_outcome_known CHECK (outcome IN ('delivered', 'accepted')),
        CONSTRAINT delivery_read_state_in_app_only
          CHECK (channel = 'in_app' OR (read_at IS NULL AND dismissed_at IS NULL))
      )
    `);

    for (const table of ['notification.notification', 'notification.delivery']) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }

    await queryRunner.query(`
      CREATE POLICY notification_tenant_select ON notification.notification
        FOR SELECT USING (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY notification_tenant_insert ON notification.notification
        FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY notification_tenant_update ON notification.notification
        FOR UPDATE USING (organization_id = ${this.boundOrganization})
                WITH CHECK (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY delivery_tenant_select ON notification.delivery
        FOR SELECT USING (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY delivery_tenant_insert ON notification.delivery
        FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})
    `);

    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON notification.notification TO esg_worker`);
    await queryRunner.query(`GRANT SELECT, INSERT ON notification.delivery TO esg_worker`);
    await queryRunner.query(`GRANT SELECT ON notification.notification, notification.delivery TO esg_admin_ro`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE notification.delivery`);
    await queryRunner.query(`DROP TABLE notification.notification`);
    // RESTRICT, the baseline's rule: a schema holding anything a later migration added refuses to go.
    await queryRunner.query(`DROP SCHEMA notification`);
  }
}
