export function matchesSearch(
  query: string,
  ...values: Array<string | null | undefined>
): boolean {
  return !query || values.some((value) => value?.toLowerCase().includes(query));
}
