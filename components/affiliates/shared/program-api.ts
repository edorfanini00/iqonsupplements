export class ProgramRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export async function requestProgram(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: 'no-store', credentials: 'include' });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new ProgramRequestError(typeof data.error === 'string' ? data.error : data.error?.message || 'Shared program request failed. No figures have been substituted.', response.status);
  return data;
}
