/** Where a node lands when the path scrolls to it: about 40 % from the top of the window. */
const TARGET_FROM_TOP = 0.4;

/** A node's element inside the path, found by its `data-node-id`. */
export function findNodeElement(container: HTMLElement, nodeId: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
}

/** Smooth scrolling unless the learner prefers less motion (`html[data-motion]`). */
export function preferredScrollBehavior(smooth: boolean): ScrollBehavior {
  return smooth && document.documentElement.dataset.motion !== "reduced" ? "smooth" : "auto";
}

/** Scrolls the window so the node sits about 40 % from the top. */
export function scrollToNode(node: HTMLElement, behavior: ScrollBehavior): void {
  const rect = node.getBoundingClientRect();
  const top = window.scrollY + rect.top + rect.height / 2 - window.innerHeight * TARGET_FROM_TOP;
  window.scrollTo({ top: Math.max(0, top), behavior });
}
