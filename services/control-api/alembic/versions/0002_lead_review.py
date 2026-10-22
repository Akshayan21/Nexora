"""Persist contact approvals and retry-safe manual creation."""

import sqlalchemy as sa
from alembic import op

revision = "0002_lead_review"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("contacts", sa.Column("approved_at", sa.DateTime(timezone=True)))
    op.add_column("contacts", sa.Column("approved_by", sa.Uuid()))
    op.add_column("contacts", sa.Column("client_request_id", sa.String(100)))
    op.add_column("contacts", sa.Column("request_hash", sa.String(64)))
    op.create_foreign_key(
        "fk_contacts_approved_by_users", "contacts", "users", ["approved_by"], ["id"]
    )
    op.create_unique_constraint(
        "uq_contacts_workspace_id_client_request_id",
        "contacts",
        ["workspace_id", "client_request_id"],
    )
    op.create_check_constraint(
        op.f("ck_contacts_approval_pair"),
        "contacts",
        "(approved_at IS NULL) = (approved_by IS NULL)",
    )


def downgrade():
    op.drop_constraint(op.f("ck_contacts_approval_pair"), "contacts", type_="check")
    op.drop_constraint("uq_contacts_workspace_id_client_request_id", "contacts", type_="unique")
    op.drop_constraint("fk_contacts_approved_by_users", "contacts", type_="foreignkey")
    for column in ["request_hash", "client_request_id", "approved_by", "approved_at"]:
        op.drop_column("contacts", column)
