"""Persist editable campaign drafts, schedule, and message subjects."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0003_campaign_details"
down_revision = "0002_lead_review"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("campaigns", "mailbox_id", nullable=True)
    op.add_column("campaigns", sa.Column("audience", sa.Text(), nullable=False, server_default=""))
    op.add_column("campaigns", sa.Column("objective", sa.Text(), nullable=False, server_default=""))
    op.add_column(
        "campaigns",
        sa.Column("settings_json", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "campaigns", sa.Column("version", sa.Integer(), nullable=False, server_default="1")
    )
    op.add_column("campaigns", sa.Column("client_request_id", sa.String(100)))
    op.add_column("campaigns", sa.Column("request_hash", sa.String(64)))
    op.create_unique_constraint(
        "uq_campaigns_workspace_id_client_request_id",
        "campaigns",
        ["workspace_id", "client_request_id"],
    )
    op.add_column(
        "campaign_steps", sa.Column("subject", sa.String(200), nullable=False, server_default="")
    )


def downgrade():
    # Refuse to discard drafts which cannot satisfy the original mailbox requirement.
    connection = op.get_bind()
    if connection.execute(
        sa.text("SELECT EXISTS(SELECT 1 FROM campaigns WHERE mailbox_id IS NULL)")
    ).scalar():
        raise RuntimeError("Assign mailboxes to all drafts before downgrading this migration")
    op.drop_column("campaign_steps", "subject")
    op.drop_constraint("uq_campaigns_workspace_id_client_request_id", "campaigns", type_="unique")
    for column in [
        "request_hash",
        "client_request_id",
        "version",
        "settings_json",
        "objective",
        "audience",
    ]:
        op.drop_column("campaigns", column)
    op.alter_column("campaigns", "mailbox_id", nullable=False)
