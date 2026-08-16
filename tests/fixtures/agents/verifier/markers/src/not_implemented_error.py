"""TC-4.10: raise NotImplementedError, with an issue reference token (#88)
on the same line — must still be BLOCKER. Unlike TBD/FIXME/XXX, this marker
has no downgrade path; the same-line reference must NOT reclassify it as
WARNING."""


def cancel_subscription(subscription_id):
    raise NotImplementedError("cancel flow pending vendor API")  # tracked in #88
