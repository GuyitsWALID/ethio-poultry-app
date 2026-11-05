export type BirdCheckValues = {
  openingBirds: number | null;
  transfersIn: number | null;
  deaths: number | null;
  culls: number | null;
  transfersOut: number | null;
  otherRemovals: number | null;
  closingBirds: number | null;
};

export type BirdCheckIssue =
  | "OPENING_SOURCE_MISSING"
  | "CLOSING_REQUIRED"
  | "MOVEMENT_INVALID"
  | "CLOSING_MISMATCH";

export type BirdCheckAssessment = {
  expectedClosingBirds: number | null;
  valid: boolean;
  issues: BirdCheckIssue[];
};

function isWholeBirdCount(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0;
}

export function assessBirdCheck(values: BirdCheckValues): BirdCheckAssessment {
  const issues: BirdCheckIssue[] = [];

  if (!isWholeBirdCount(values.openingBirds)) issues.push("OPENING_SOURCE_MISSING");
  if (!isWholeBirdCount(values.closingBirds)) issues.push("CLOSING_REQUIRED");
  const movements = [values.transfersIn, values.deaths, values.culls, values.transfersOut, values.otherRemovals];
  if (!movements.every(isWholeBirdCount)) issues.push("MOVEMENT_INVALID");

  const expectedClosingBirds = isWholeBirdCount(values.openingBirds) && movements.every(isWholeBirdCount)
    ? values.openingBirds + movements[0] - movements[1] - movements[2] - movements[3] - movements[4]
    : null;

  if (
    expectedClosingBirds !== null
    && isWholeBirdCount(values.closingBirds)
    && expectedClosingBirds !== values.closingBirds
  ) {
    issues.push("CLOSING_MISMATCH");
  }

  return {expectedClosingBirds, valid: issues.length === 0, issues};
}
