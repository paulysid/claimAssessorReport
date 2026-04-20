{
  "type": "object",
  "properties": {
    "targets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "targetId": { "type": "string" },
          "targetType": { "type": "string", "enum": ["lot", "common"] },
          "displayName": { "type": "string" },
          "aliases": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["targetId", "targetType", "displayName", "aliases"],
        "additionalProperties": false
      }
    },
    "candidateSections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "sectionId": { "type": "string" },
          "title": { "type": "string" },
          "startPage": { "type": "integer" },
          "endPage": { "type": "integer" },
          "sectionType": { "type": "string" }
        },
        "required": ["sectionId", "title", "startPage", "endPage", "sectionType"],
        "additionalProperties": false
      }
    }
  },
  "required": ["targets", "candidateSections"],
  "additionalProperties": false
}
