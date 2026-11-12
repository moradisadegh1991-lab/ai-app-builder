/** Repair only JSON string encoding, preserving the generated source bytes.
 * Models sometimes emit JS regex escapes (e.g. \w) or literal newlines inside
 * a JSON string. Never guess missing keys, quotes, commas or truncated content.
 */
function parseEncodedJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (original) {
    let inside = false;
    let repaired = "";
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i]!;
      if (char === '"') inside = !inside;
      if (inside && char === "\\") {
        const next = raw[i + 1];
        const valid =
          next && ('"\\/bfnrt'.includes(next) || (next === "u" && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))));
        if (valid) {
          repaired += char + next;
          i++;
        } else repaired += "\\\\";
      } else if (inside && char.charCodeAt(0) < 32) repaired += JSON.stringify(char).slice(1, -1);
      else repaired += char;
    }
    if (repaired === raw) throw original;
    return JSON.parse(repaired);
  }
}

/**
 * Extracts the JSON object from a model response. Models sometimes wrap JSON
 * in markdown fences or add a sentence before it even in JSON mode.
 */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return parseEncodedJson(trimmed);
  } catch {
    // fall through to lenient extraction
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return parseEncodedJson(fenced[1].trim());
    } catch {
      // fall through
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return parseEncodedJson(trimmed.slice(start, end + 1));
  }
  throw new Error("پاسخ مدل هوش مصنوعی JSON معتبر نبود.");
}
