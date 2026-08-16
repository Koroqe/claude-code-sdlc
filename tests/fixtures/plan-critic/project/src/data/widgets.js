// Fixture data layer for the plan-critic test fixtures. Represents the
// pre-existing state the "Widget Status Badge" plan fixtures start from: the
// `status` column already exists and is already selected by this query.

const WIDGETS = [
  { id: 1, name: 'Alpha', status: 'active' },
  { id: 2, name: 'Beta', status: 'archived' },
  { id: 3, name: 'Gamma', status: 'pending' },
];

/** Returns every widget row, including its lifecycle `status` column. */
async function listWidgets() {
  return WIDGETS;
}

module.exports = { listWidgets };
