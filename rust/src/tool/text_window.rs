const OMITTED_COLUMNS_LABEL: &str = "omitted columns";

fn char_count(text: &str) -> usize {
    text.chars().count()
}

fn slice_chars(text: &str, start: usize, end: usize) -> String {
    text.chars()
        .skip(start)
        .take(end.saturating_sub(start))
        .collect()
}

fn join_column_window(line: &str, line_number: usize, start: usize, end: usize) -> String {
    let total = char_count(line);
    let mut output = String::new();

    if start > 0 {
        output.push_str(&format!(
            "[{} 1..{} of line {}] ... ",
            OMITTED_COLUMNS_LABEL, start, line_number
        ));
    }

    output.push_str(&slice_chars(line, start, end));

    if end < total {
        output.push_str(&format!(
            " ... [{} {}..{} of line {}]",
            OMITTED_COLUMNS_LABEL,
            end + 1,
            total,
            line_number
        ));
    }

    output
}

pub(crate) fn format_column_window(
    line: &str,
    line_number: usize,
    offset: usize,
    limit: usize,
) -> String {
    let total = char_count(line);
    let start = offset.min(total);
    let end = start.saturating_add(limit).min(total);

    join_column_window(line, line_number, start, end)
}

pub(crate) fn format_balanced_line_window(line: &str, line_number: usize, limit: usize) -> String {
    let total = char_count(line);

    if total <= limit {
        return line.to_string();
    }

    if limit == 0 {
        return format!(
            "[{} 1..{} of line {}]",
            OMITTED_COLUMNS_LABEL, total, line_number
        );
    }

    let head_length = limit.div_ceil(2);
    let tail_length = limit - head_length;
    let omitted_start = head_length;
    let omitted_end = total - tail_length;
    let head = slice_chars(line, 0, head_length);
    let omitted = format!(
        "[{} {}..{} of line {}]",
        OMITTED_COLUMNS_LABEL,
        omitted_start + 1,
        omitted_end,
        line_number
    );

    if tail_length == 0 {
        format!("{} ... {}", head, omitted)
    } else {
        let tail = slice_chars(line, omitted_end, total);
        format!("{} ... {} ... {}", head, omitted, tail)
    }
}

pub(crate) fn format_focused_line_window(
    line: &str,
    line_number: usize,
    focus_start: usize,
    focus_end: usize,
    limit: usize,
) -> String {
    let total = char_count(line);

    if total <= limit {
        return line.to_string();
    }

    if limit == 0 {
        return format!(
            "[{} 1..{} of line {}]",
            OMITTED_COLUMNS_LABEL, total, line_number
        );
    }

    let focus_start = focus_start.min(total);
    let focus_end = focus_end.max(focus_start + 1).min(total);
    let focus_length = focus_end - focus_start;
    let max_start = total.saturating_sub(limit);
    let start = if focus_length >= limit {
        focus_start.min(max_start)
    } else {
        focus_start
            .saturating_sub((limit - focus_length) / 2)
            .min(max_start)
    };
    let end = start.saturating_add(limit).min(total);

    join_column_window(line, line_number, start, end)
}

pub(crate) fn byte_offset_to_char_index(text: &str, byte_offset: usize) -> usize {
    let mut columns = 0;

    for (index, _) in text.char_indices() {
        if index >= byte_offset {
            return columns;
        }
        columns += 1;
    }

    columns
}
