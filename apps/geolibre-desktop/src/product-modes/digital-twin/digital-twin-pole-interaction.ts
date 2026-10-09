export type DigitalTwinPoleSelectionMode = "replace" | "add";

export function selectDigitalTwinPoleIds(
  selectedPoleIds: readonly string[],
  poleId: string,
  mode: DigitalTwinPoleSelectionMode
): string[] {
  if (mode === "replace") return [poleId];
  return selectedPoleIds.includes(poleId)
    ? [...selectedPoleIds]
    : [...selectedPoleIds, poleId];
}
