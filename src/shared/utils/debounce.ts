/**
 * A standard debounce function that delays the execution of the provided function
 * until after the specified wait time has elapsed since the last time it was invoked.
 *
 * @param fn The function to debounce.
 * @param wait The time in milliseconds to wait before invoking the function.
 * @returns A debounced version of the provided function.
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function(this: any, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      fn.apply(this, args)
    }, wait)
  }
}
