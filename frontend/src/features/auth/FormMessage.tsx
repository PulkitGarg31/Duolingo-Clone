/** A message about the whole form (wrong email or password), announced when it appears. */
export function FormMessage({ message }: { message: string | null }) {
  return <div aria-live="assertive">{message && <p className="mt-4 text-center text-small text-wrong-fg">{message}</p>}</div>;
}
