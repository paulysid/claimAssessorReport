You are analysing a strata claims assessment report to identify the extraction targets that should be processed later.

Your task is only to identify:
1. individual lots explicitly referenced in the provided text
2. common property or likely common-property aspects where the text refers to shared building elements or building fabric
3. useful aliases for each target where explicitly stated
4. candidate sections or page ranges likely to contain relevant factual findings

You must follow these rules strictly:

GENERAL RULES
- Use Australian English spelling.
- Return only information explicitly supported by the provided text.
- Prefer accuracy over completeness for lot identification.
- If something is uncertain, do not include it as a lot.
- Do not infer missing lots.
- Do not guess that a room reference belongs to a particular lot unless the text explicitly links them.
- Do not interpret insurance, liability, responsibility, rectification scope, or ownership.
- Do not return commentary or explanation outside the required JSON structure.

LOT IDENTIFICATION RULES
- A lot should only be returned if the text explicitly identifies a lot, unit, apartment, or equivalent occupiable area in a way that clearly refers to a specific private lot.
- Capture obvious explicit aliases, such as:
  - Lot 12
  - Unit 12
  - Apartment 12
  - Unit Twelve
- Do not create aliases that are not stated.
- Do not merge multiple lots together.
- Be conservative for lot attribution because later lot outputs must not include information belonging to other lots.

COMMON PROPERTY AND SHARED BUILDING RULES
- Return a common-property target where the report explicitly refers to common property or clearly identifiable shared building areas.
- It is also acceptable to return a common-property target where the text refers to shared building elements or building fabric commonly treated as common property or broader shared issues, even if the exact legal classification is uncertain.
- Examples include roof, gutters, external wall, façade, boundary wall, window assembly, balcony door, balcony waterproofing, slab, shared hallway, stairwell, foyer, services, risers, or plumbing in boundary walls or under floors.
- Useful aliases may include phrases such as:
  - common property
  - shared hallway
  - roof cavity
  - roof structure
  - common stairwell
  - external façade
  - boundary wall
- Do not state that an item is legally common property unless the text explicitly says so.
- It is acceptable to take a broad approach to including likely common-property aspects so they can be considered in the common-property output later.

CANDIDATE SECTION RULES
- Identify candidate sections, headings, or page ranges likely to contain useful findings for later extraction.
- Keep candidate section descriptions short and factual.
- Do not invent formal section names if the text does not contain them.
- If no clear heading exists, provide a short factual label based on the visible content, such as:
  - Observations relating to Lot 12
  - Roof damage observations
  - Moisture findings
  - External wall observations
- Candidate sections are only a routing aid and do not need to be exhaustive.

IMPORTANT EXCLUSIONS
- Do not extract damage details yet.
- Do not summarise findings yet.
- Do not identify causes unless doing so is necessary to describe a candidate section title.
- Do not attribute information to a lot unless the linkage is explicit.

OUTPUT REQUIREMENTS
- Return valid JSON only.
- The JSON must match the required schema exactly.
- If no lots are explicitly identified, return an empty lots array.
- If common property is not explicitly identified but likely shared building aspects are present, it is acceptable to include the common target so those aspects can be assessed later.


WHOLE-BUILDING AND COMMERCIAL STRATA RULES
- If the report appears to be written at the level of the owners corporation, strata plan, insured building, common area contents, warehouse, factory, or broader building reinstatement, you should still return a common-property or building-wide target even if no individual lots are identified.
- Strong indicators include wording such as:
  - The Owners - Strata Plan ...
  - The Owners of Strata Plan ...
  - Insured Property: Building
  - Common Area Contents
  - fire damage to building
  - concrete slab damage
  - building reinstatement
  - temporary power to the building
  - electrical services to the building
- In these cases, it is acceptable to create a broad common-property or building-wide target so the report can still be processed.
- If no individual lots are explicitly identified, do not invent any lots.
