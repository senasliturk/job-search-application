"""Grant the `admin` role to a Firebase user.

The Job Posting Service's require_admin dependency checks for a custom
claim `role=admin` (or `role=company`). Firebase user-creation doesn't
set custom claims by default, so run this script once after creating your
admin account.

Usage:

    # From repo root, after putting secrets/firebase-sa.json in place:
    pip install firebase-admin
    python scripts/grant_admin.py admin@example.com

You can re-run with `--role company` to make someone a company user
instead of full admin.
"""
from __future__ import annotations

import argparse
import os
import sys

import firebase_admin
from firebase_admin import auth, credentials


def main() -> int:
    ap = argparse.ArgumentParser(description="Grant admin/company role to a Firebase user.")
    ap.add_argument("email", help="Email of the user to grant the role to.")
    ap.add_argument("--role", default="admin", choices=["admin", "company"])
    ap.add_argument(
        "--key",
        default="secrets/firebase-sa.json",
        help="Path to Firebase service-account JSON.",
    )
    args = ap.parse_args()

    if not os.path.exists(args.key):
        print(f"Service-account file not found: {args.key}", file=sys.stderr)
        print("Download it from Firebase Console → Project Settings → Service accounts.", file=sys.stderr)
        return 1

    firebase_admin.initialize_app(credentials.Certificate(args.key))

    try:
        user = auth.get_user_by_email(args.email)
    except auth.UserNotFoundError:
        print(f"No user with email {args.email}. Create them in Firebase Authentication first.", file=sys.stderr)
        return 2

    existing = user.custom_claims or {}
    existing["role"] = args.role
    auth.set_custom_user_claims(user.uid, existing)

    print(f"✓ Set role={args.role} on {args.email} (uid={user.uid}).")
    print("  The user must sign out and sign in again for the new claim to take effect.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
