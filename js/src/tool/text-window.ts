const OMITTED_COLUMNS_LABEL = 'omitted columns';

function columnsOf(text: string) {
  return Array.from(text);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeIndex(value: number | undefined, fallback: number) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function joinColumnWindow(
  columns: string[],
  lineNumber: number,
  start: number,
  end: number
) {
  const before =
    start > 0
      ? `[${OMITTED_COLUMNS_LABEL} 1..${start} of line ${lineNumber}] ... `
      : '';
  const body = columns.slice(start, end).join('');
  const after =
    end < columns.length
      ? ` ... [${OMITTED_COLUMNS_LABEL} ${end + 1}..${columns.length} of line ${lineNumber}]`
      : '';

  return `${before}${body}${after}`;
}

export function formatColumnWindow(input: {
  line: string;
  lineNumber: number;
  offset?: number;
  limit: number;
}) {
  const columns = columnsOf(input.line);
  const offset = clamp(normalizeIndex(input.offset, 0), 0, columns.length);
  const limit = normalizeIndex(input.limit, columns.length);
  const end = Math.min(offset + limit, columns.length);

  return joinColumnWindow(columns, input.lineNumber, offset, end);
}

export function formatBalancedLineWindow(input: {
  line: string;
  lineNumber: number;
  limit: number;
}) {
  const columns = columnsOf(input.line);
  const limit = normalizeIndex(input.limit, columns.length);

  if (columns.length <= limit) return input.line;
  if (limit === 0) {
    return `[${OMITTED_COLUMNS_LABEL} 1..${columns.length} of line ${input.lineNumber}]`;
  }

  const headLength = Math.ceil(limit / 2);
  const tailLength = limit - headLength;
  const omittedStart = headLength;
  const omittedEnd = columns.length - tailLength;
  const head = columns.slice(0, headLength).join('');
  const tail = tailLength > 0 ? columns.slice(omittedEnd).join('') : '';
  const omitted = `[${OMITTED_COLUMNS_LABEL} ${omittedStart + 1}..${omittedEnd} of line ${input.lineNumber}]`;

  return tail ? `${head} ... ${omitted} ... ${tail}` : `${head} ... ${omitted}`;
}

export function formatFocusedLineWindow(input: {
  line: string;
  lineNumber: number;
  focusStart: number;
  focusEnd: number;
  limit: number;
}) {
  const columns = columnsOf(input.line);
  const limit = normalizeIndex(input.limit, columns.length);

  if (columns.length <= limit) return input.line;
  if (limit === 0) {
    return `[${OMITTED_COLUMNS_LABEL} 1..${columns.length} of line ${input.lineNumber}]`;
  }

  const focusStart = clamp(
    normalizeIndex(input.focusStart, 0),
    0,
    columns.length
  );
  const focusEnd = clamp(
    Math.max(normalizeIndex(input.focusEnd, focusStart + 1), focusStart + 1),
    focusStart + 1,
    columns.length
  );
  const focusLength = focusEnd - focusStart;
  const maxStart = Math.max(0, columns.length - limit);
  const start =
    focusLength >= limit
      ? clamp(focusStart, 0, maxStart)
      : clamp(focusStart - Math.floor((limit - focusLength) / 2), 0, maxStart);
  const end = Math.min(start + limit, columns.length);

  return joinColumnWindow(columns, input.lineNumber, start, end);
}

export function byteOffsetToColumnIndex(text: string, byteOffset: number) {
  let bytes = 0;
  let column = 0;

  for (const char of text) {
    const nextBytes = bytes + Buffer.byteLength(char);
    if (nextBytes > byteOffset) break;
    bytes = nextBytes;
    column++;
  }

  return column;
}
