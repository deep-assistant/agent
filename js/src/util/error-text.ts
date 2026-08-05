/**
 * Human-readable rendering of arbitrary error values (issue #289).
 *
 * JSON `error` events used to carry only the machine-readable
 * `NamedError.toObject()` shape (`{name, data: {message}}`), so consumers doing
 * `` `${record.error}` `` published `[object Object]` and the real cause was
 * lost. Every emitted `error` event now also carries a `message` string
 * produced by `stringifyErrorValue`.
 *
 * The renderer is circular-safe and depth-limited, and never invents a
 * placeholder: when nothing readable can be derived it returns an empty
 * string so the caller can pick its own fallback.
 */

const MAX_DEPTH = 5;

function fromParts(name: string | undefined, message: string | undefined) {
  if (name && message) return `${name}: ${message}`;
  return message || name || '';
}

function render(value: unknown, depth: number, seen: Set<object>): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (typeof value !== 'object') return '';

  const object = value as Record<string, unknown>;
  if (seen.has(object)) return '';
  if (depth >= MAX_DEPTH) return '';
  seen.add(object);

  if (Array.isArray(object)) {
    const rendered = object
      .map((item) => render(item, depth + 1, seen))
      .filter((item) => item.length > 0);
    return rendered.join('; ');
  }

  if (object instanceof Error) {
    return fromParts(object.name, object.message) || String(object);
  }

  // NamedError.toObject(): { name, data: { message, ... } }
  const name = typeof object.name === 'string' ? object.name : undefined;
  const data = object.data;
  if (data && typeof data === 'object') {
    const dataMessage = render(
      (data as Record<string, unknown>).message,
      depth + 1,
      seen
    );
    if (dataMessage) return fromParts(name, dataMessage);
  }

  const message = render(object.message, depth + 1, seen);
  if (message) return fromParts(name, message);

  // Envelope shapes: { error: … }, { cause: … }
  const nested =
    render(object.error, depth + 1, seen) ||
    render(object.cause, depth + 1, seen);
  if (nested) return name ? fromParts(name, nested) : nested;

  return name || '';
}

/**
 * Render any error-ish value as a human-readable string.
 * Returns an empty string when nothing readable can be derived.
 */
export function stringifyErrorValue(value: unknown): string {
  return render(value, 0, new Set<object>());
}

/**
 * Same as {@link stringifyErrorValue} but guarantees a non-empty string.
 */
export function errorText(value: unknown, fallback = 'Unknown error'): string {
  return stringifyErrorValue(value) || fallback;
}
