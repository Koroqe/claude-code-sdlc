"""TC-4.11: the compound pattern `pass  # TODO` as a function body. Contains
the bare, WARNING-tier token TODO, but the compound as a whole denotes an
empty implementation, not deferred cleanup — expected: BLOCKER
(unconditional). verifier must check this compound pattern before applying
the bare-TODO WARNING rule."""


def send_welcome_email(user):
    pass  # TODO
