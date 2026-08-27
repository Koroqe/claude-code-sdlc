# Fixture: reduced-motion-overcorrection

Fixture project for TC-18.2 (docs/qa/design-capability_test_cases.md). The reduced-motion
media query exists — but it over-corrects, killing ALL feedback instead of only the travel.
This is the opposite failure from `tokens-declared-no-preview/`'s missing-handling case,
and the finding's Why text must distinguish the two.

## Setup

`diff.patch` is the changed-files surface. `src/components/card.css` has a base entrance
animation (translate + scale + opacity) plus color/opacity transitions, and then:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none;
    animation: none;
  }
}
```

The universal `*` block removes not just the travel and scale (correct) but also every
opacity and background-color transition (over-correction): reduced means fewer and gentler
— keep opacity/color feedback, remove travel, scale, parallax, and overshoot — it does not
mean remove all feedback.

There is no `.claude/rules/design.md` here; the reduced-motion rule is part of the
universal quality floor and needs no declaration to apply.

## Expected result

Invoke `design-reviewer` with `diff.patch` as the changed-files surface. The findings table
reports the over-correction, with Why text distinguishing it from the missing-handling case
(TC-18.1): the media query is present but removes opacity/color feedback too, where the
correct reduction keeps them.

## Do not add

Never "fix" the `*` block into a correct reduction — the over-correction IS the fixture.
And never add a `.claude/` directory, a preview-recipe declaration, a browser-automation
capture dependency (no `package.json` naming one), or a trust-registry dependency — any
executable-recipe addition converts a no-execution fixture into one that runs
repo-controlled commands.
