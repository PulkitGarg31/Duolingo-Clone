/**
 * The node id in `/learn?focus=7`, which the lesson player adds when it sends the learner back to the path;
 * null when it is missing or not a positive whole number.
 */
export function parseFocusParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const nodeId = Number(raw);
  return nodeId > 0 ? nodeId : null;
}
