const en = {
 title: "Approved daily feed target", age: "Bird age (days)", birds: "Opening birds", grams: "Grams per bird per day", target: "Daily target (kg)", allocated: "Planned across sessions (kg)", remaining: "Unallocated target (kg)",
 help: "Split the daily target across as many feedings as needed. This is the whole day's target, not the amount for each feeding. A missed session still counts toward the recorded plan. Negative unallocated feed means the plan exceeds the target; it does not authorize extra stock.",
 unavailable: "Unavailable", missing_template: "No approved active feed template. Select the actual feed type explicitly and ask for a template through Feed templates.",
 missing_age_range: "The approved template does not cover this flock's age on this date. Request an updated template; no target has been assumed.",
 missing_population: "A feed rate is configured, but the opening bird count is not trusted for this date. Review the bird-count evidence before calculating a daily quantity.",
 invalid_template: "The template's feed rate or feed type is invalid. Request an approved correction; no default feed type has been selected.",
 templateManaged: "Managed by the approved feed template. Change the template through Approvals, not by editing this Scheduler rule.",
};
const am: typeof en = {
 title: "የተፈቀደ የቀን መኖ ግብ", age: "የዶሮ ዕድሜ (ቀናት)", birds: "የቀኑ መጀመሪያ ዶሮዎች", grams: "በቀን ለአንድ ዶሮ ግራም", target: "የቀን ግብ (ኪ.ግ)", allocated: "በምገባዎች የታቀደ (ኪ.ግ)", remaining: "ያልተመደበ ግብ (ኪ.ግ)",
 help: "የቀኑን ግብ በሚያስፈልጉት ምገባዎች ይከፋፍሉ። ይህ የሙሉ ቀኑ ግብ እንጂ የእያንዳንዱ ምገባ መጠን አይደለም። ያልተከናወነ ምገባም በተመዘገበው እቅድ ይቆጠራል። አሉታዊ ያልተመደበ መጠን እቅዱ ግቡን እንዳለፈ ያሳያል፤ ተጨማሪ ክምችት ለመጠቀም ፈቃድ አይሰጥም።",
 unavailable: "አይገኝም", missing_template: "የተፈቀደ ንቁ የመኖ አብነት የለም። ትክክለኛውን የመኖ ዓይነት ይምረጡ እና በመኖ አብነቶች አብነት ይጠይቁ።",
 missing_age_range: "የተፈቀደው አብነት በዚህ ቀን ያለውን የመንጋውን ዕድሜ አይሸፍንም። አብነቱ እንዲሻሻል ይጠይቁ፤ ግብ አልተገመተም።",
 missing_population: "የመኖ መጠን ተዋቅሯል፤ ግን የዚህ ቀን መጀመሪያ የዶሮ ብዛት አልተረጋገጠም። የቀን መጠን ከማስላት በፊት የብዛት ማስረጃውን ያረጋግጡ።",
 invalid_template: "የአብነቱ የመኖ መጠን ወይም ዓይነት ትክክል አይደለም። የተፈቀደ ማስተካከያ ይጠይቁ፤ ነባሪ የመኖ ዓይነት አልተመረጠም።",
 templateManaged: "በተፈቀደው የመኖ አብነት ይተዳደራል። ይህን የጊዜ ሰሌዳ ደንብ ከማርትዕ ይልቅ አብነቱን በፈቃዶች ይቀይሩ።",
};
export const feedPlanCopy = {en, am};
