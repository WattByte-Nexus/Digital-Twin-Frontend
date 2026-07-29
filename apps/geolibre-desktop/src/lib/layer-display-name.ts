export interface LayerDisplayName {
  primary: string;
  runLabel?: string;
}

/**
 * Keep generated processing identifiers available without letting them
 * dominate the Layers panel. User-authored names are returned unchanged.
 */
export function formatLayerDisplayName(name: string): LayerDisplayName {
  const match = name.match(/^(.*?)\s*[·•]\s*run[-_:]?([a-z0-9-]{12,})$/i);
  if (!match) return { primary: name };

  const primary = match[1]?.trim();
  const identifier = match[2];
  if (!primary || !identifier) return { primary: name };

  const compactIdentifier =
    identifier.length > 12 ? `${identifier.slice(0, 6)}…${identifier.slice(-4)}` : identifier;

  return {
    primary,
    runLabel: `Run ${compactIdentifier}`,
  };
}
