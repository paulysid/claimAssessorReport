{
  "type": "object",
  "properties": {
    "targetId": { "type": "string" },
    "evidenceItems": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "evidenceId": { "type": "string" },
          "pageStart": { "type": "integer" },
          "pageEnd": { "type": "integer" },
          "summary": { "type": "string" },
          "rawSnippet": { "type": "string" },
          "appliesTo": { "type": "array", "items": { "type": "string" } },
          "explicitness": { "type": "string", "enum": ["explicit", "context-linked", "ambiguous"] },
          "confidence": { "type": "string", "enum": ["high", "medium", "low"] },
          "included": { "type": "boolean" }
        },
        "required": ["evidenceId", "pageStart", "pageEnd", "summary", "rawSnippet", "appliesTo", "explicitness", "confidence"],
        "additionalProperties": false
      }
    }
  },
  "required": ["targetId", "evidenceItems"],
  "additionalProperties": false
}
