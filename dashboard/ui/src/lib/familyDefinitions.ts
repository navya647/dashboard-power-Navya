/** Plain one-line definitions for the key indicator families, written for the dashboard and signed
 * off by the user (28 Oct 2026). They are the dashboard's own summary, not the sheet's text: the
 * Glossary labels them so and keeps every state's own wording underneath. Keys are the sheet's
 * `indicator_family`, exactly. */
export const FAMILY_DEFINITIONS: Record<string, string> = {
  SAIDI: "Average total time a consumer is without power over the period, from interruptions longer than 5 minutes.",
  SAIFI: "Average number of times a consumer’s supply is interrupted for longer than 5 minutes over the period.",
  CAIDI: "Average time taken to restore supply after an interruption (SAIDI ÷ SAIFI).",
  CAIFI: "Average number of interruptions per consumer, counting only consumers who had at least one interruption.",
  MAIFI: "Average number of momentary interruptions (5 minutes or shorter) a consumer experiences.",
  "Hours of supply": "Number of hours a day for which electricity is supplied.",
  "Voltage variation limit - LV": "How far supply voltage at low voltage may stray above or below its declared value.",
  "Voltage complaint - no network expansion needed":
    "Time allowed to fix a voltage complaint that needs only local work, such as adjusting a transformer tap.",
  "Distribution transformer failure - replacement & restoration": "Time allowed to restore supply after a distribution transformer fails.",
  "Distribution transformer failure rate": "Share of distribution transformers that fail during the year.",
  "Restoration after LT-side DT fuse / consumer-end fault":
    "Time allowed to restore supply after a fuse blows on the low-voltage side of a distribution transformer.",
  "Restoration after HT-side DT fuse / drop-out fuse":
    "Time allowed to restore supply after a fuse blows on the high-voltage side of a distribution transformer.",
  "Power transformer / switchgear failure repair or replacement":
    "Time allowed to restore supply after a substation power transformer or switchgear fails.",
  "Power transformer failure - interim restoration":
    "Time allowed to restore supply by a temporary arrangement while a failed power transformer is repaired.",
  "Overhead line/cable breakdown restoration": "Time allowed to restore supply after an overhead line or cable breaks down.",
  "Advance notice of scheduled outage": "How far ahead consumers must be told about a planned power cut.",
  "New connection - supply from existing network": "Time allowed to give a new connection where the existing network can serve it.",
  "Reconnection after payment of dues": "Time allowed to restore supply after a disconnected consumer pays what they owe.",
  "Defective (slow/fast/stuck) meter replacement": "Time allowed to replace a meter found to be running slow, fast or stuck.",
  "Billing complaint resolution (unsplit)": "Time allowed to resolve a complaint about a bill.",
  "Billing complaint - no additional information required": "Time allowed to resolve a billing complaint that can be settled on the spot.",
  "Billing complaint - additional information required":
    "Time allowed to resolve a billing complaint that needs records checked or more information.",
  "Billing complaint acknowledgement": "Time allowed to acknowledge a billing complaint once it is received.",
  "Billing complaint - arithmetical error / non-receipt":
    "Time allowed to fix a calculation error in a bill, or to deal with a bill that never arrived.",
  "Billing complaint - site visit required": "Time allowed to resolve a billing complaint that needs someone to visit the premises.",
  "Billing mistakes (share of bills)": "Share of bills issued that contain errors.",
  "Bill delivery timeliness": "Whether bills reach consumers within the required time.",
  "First bill after new connection": "Time allowed to issue the first bill after a new connection is given.",
  "Provisional/average billing duration":
    "Longest period a consumer may be billed on an estimate instead of an actual meter reading.",
  "Final bill on vacation / special reading":
    "Time allowed to issue a final bill when a consumer leaves the premises or asks for a special reading.",
  "Refund of excess amount billed": "Time allowed to refund money a consumer was overcharged.",
  "Billing efficiency": "Share of the electricity supplied that is actually billed to consumers.",
  "Compensation payment": "Compensation the utility must pay a consumer when it misses a service standard.",
  "Complaint registration & number issue": "Whether a complaint is logged and the consumer given a reference number.",
  "24x7 call centre / help desk availability": "Whether consumers can reach a complaint line at any hour.",
  "Compliance with safety regulations": "Whether the utility builds, runs and maintains its lines in line with electrical safety regulations.",
  "Earthing of equipment, lines and substations":
    "Whether equipment, lines and substations are properly earthed, so a fuse or breaker trips at once if a live wire falls.",
  "Fatal accident reporting":
    "Whether the utility keeps records of fatal electrical accidents and reports the investigation and action taken to the regulator.",
  "Solatium payment - accident not victim's fault":
    "Time allowed to pay compensation (solatium) to an accident victim or their family when the victim was not at fault.",
  "Solatium payment - other accident cases": "Time allowed to pay compensation (solatium) for accidents in all other cases.",
};
