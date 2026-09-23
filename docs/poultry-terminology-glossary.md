# Farm Operations Terminology Glossary

Status: **Approved following poultry-partner review**
Scope: Farm Manager Today workflow and its direct validation messages
Glossary version: **2026-09-23-approved-1**
Last updated: 2026-09-23

This glossary favors short instructions that a Farm Manager can act on immediately. It deliberately avoids audit, accounting, and software terminology in the primary workflow. Technical terms remain available in advanced history views.

## Approved-source basis

- [SNV-RAYEE Poultry Amharic Manual](https://www.scribd.com/document/923086592/Poultry-Amharic-Manual) — consulted for Amharic poultry husbandry vocabulary and farmer-facing phrasing.
- [ILO On-job-training manual for the poultry sector](https://www.ilo.org/sites/default/files/wcmsp5/groups/public/%40africa/%40ro-abidjan/%40sro-addis_ababa/documents/publication/wcms_856407.pdf) — consulted for practical Ethiopian poultry workflows, including feed intake, bird weight, vaccination, treatment, mortality, egg production, and record keeping.

The English and Amharic terminology below was reviewed and approved by the product owner's poultry partner on 2026-09-23. The requested change, **Pullet - ቄብ**, is incorporated in this version.

The catalogue coverage for this draft is locked in `src/i18n/terminology-review.ts`. Automated tests require every current `Common`, `Navigation`, `Today`, and `Errors` message to remain in that review inventory. Adding a new Today message therefore requires adding it to the terminology review as well.

## Core navigation and daily work

| Meaning | English shown to manager | Approved Amharic | Avoid in primary workflow |
|---|---|---|---|
| Work due today | Today’s work | የዛሬ ሥራ | Operations workspace |
| Bird group | Flock | መንጋ | Production unit |
| Poultry house | House | የዶሮ ቤት | Facility asset |
| Count living birds | Check birds | ዶሮዎችን ይቁጠሩ | Reconcile flock count |
| Feed given | Record feeding | መኖ ይመዝግቡ | Feed-session posting |
| Eggs collected | Record eggs | እንቁላል ይመዝግቡ | Production capture |
| Water used | Record water | ውሃ ይመዝግቡ | Water-consumption metric |
| Illness and treatment | Health problem or treatment | የጤና ችግር ወይም ሕክምና | Health event |
| Birds that died | Deaths | ሞት | Mortality allocation |
| Non-feed items used | Supplies used | የተጠቀሙት እቃ | Routine inventory usage |
| Final daily confirmation | Finish day | ቀኑን ጨርስ | Atomic operating-day close |

## Bird count and movement

| Meaning | English shown to manager | Approved Amharic | Avoid in primary workflow |
|---|---|---|---|
| Birds alive at the start of the day | Birds at the start of the day | በቀኑ መጀመሪያ ያሉ ዶሮዎች | Opening balance |
| Birds alive at the end of the day | Birds remaining at the end of the day | በቀኑ መጨረሻ የቀሩ ዶሮዎች | Closing balance |
| Birds brought into the flock | Birds moved in | ወደ መንጋው የገቡ ዶሮዎች | Transfer in |
| Birds moved out of the flock | Birds moved out | ከመንጋው የወጡ ዶሮዎች | Transfer out |
| Birds deliberately removed | Birds removed from the flock | ከመንጋው የተወገዱ ዶሮዎች | Culls |
| Count equation does not agree | The bird numbers do not agree | የዶሮዎቹ ቁጥር አይዛመድም | Bird-day imbalance |
| Previous end count | Yesterday’s remaining birds | ትናንት የቀሩ ዶሮዎች | Prior closing quantity |

## Poultry and flock types

These labels describe what the birds are raised for and their stage of growth. The Amharic wording was checked against the terms used by the poultry partner.

| Meaning | English shown to manager | Approved Amharic | Practical explanation |
|---|---|---|---|
| Poultry kept mainly for meat | Broiler | የሥጋ ዶሮ | A fast-growing bird raised mainly for meat. |
| Poultry kept mainly for eggs | Layer | የእንቁላል ዶሮ | A hen kept mainly for egg production. |
| Poultry kept for both meat and eggs | Dual-purpose chicken | ለሥጋና ለእንቁላል የሚውል ዶሮ | A breed used for both egg production and meat. |
| Poultry kept to produce fertile eggs or chicks | Breeder flock | የመራቢያ ዶሮ መንጋ | Parent birds used to produce hatching eggs or replacement chicks. |
| Newly hatched young bird | Chick | ጫጩት | A young bird from hatching through the earliest growth stage. |
| Young female before regular egg laying | Pullet | ቄብ | A young female chicken that has not yet entered regular lay. |
| Bird in the main growth stage | Grower | እያደገ ያለ ዶሮ | A bird between the chick stage and adult production stage. |
| Young layer close to first egg | Ready-to-lay pullet | እንቁላል መጣል ልትጀምር የደረሰች ቄብ | A pullet approaching the start of egg production. |
| Adult female chicken | Hen | ሴት ዶሮ | An adult female chicken, usually of laying or breeding age. |
| Adult male chicken | Rooster | ወንድ ዶሮ | An adult male chicken used for breeding or flock management. |
| Young male chicken | Cockerel | ወጣት ወንድ ዶሮ | A male chicken that has not yet reached full maturity. |
| Layer at the end of its planned laying cycle | End-of-lay hen | የእንቁላል ምርት ዘመኗን ያጠናቀቀች ዶሮ | A hen whose planned commercial laying period is complete. |
| Birds managed together from placement onward | Batch | በአንድ ጊዜ የገባ የዶሮ ቡድን | Birds placed and managed together as one production group. |

## Feeding and growth

| Meaning | English shown to manager | Approved Amharic | Avoid in primary workflow |
|---|---|---|---|
| Feed planned for a session | Planned feed | የታቀደ መኖ | Planned ration allocation |
| Feed actually given | Feed given | የተሰጠ መኖ | Actual feed posting |
| Feed left after feeding | Feed left over | የቀረ መኖ | Residual feed |
| One scheduled feeding | Feeding time | የመመገቢያ ጊዜ | Feed session |
| Finish all feeding work | Finish today’s feeding | የዛሬን አመጋገብ ጨርስ | Close feed day |
| Feed plan is incomplete | Some planned feeding is not recorded | ከታቀደው አመጋገብ ያልተመዘገበ አለ | Plan completion gap |
| Bird weight measured | Bird weight | የዶሮ ክብደት | Weight response |
| Expected weight for age | Weight expected at this age | በዚህ ዕድሜ የሚጠበቅ ክብደት | Age-standard target |
| Birds close in weight | Birds are similar in weight | ዶሮዎቹ በክብደት ይቀራረባሉ | Uniformity |
| Feed used per bird per day | Feed used for each bird today | ዛሬ ለእያንዳንዱ ዶሮ የተጠቀመ መኖ | Feed/bird-day |

## Eggs, water, health, and medicine

| Meaning | English shown to manager | Approved Amharic | Avoid in primary workflow |
|---|---|---|---|
| Saleable eggs | Good eggs | ጥሩ እንቁላሎች | Marketable output |
| Cracked or broken eggs | Broken eggs | የተሰበሩ እንቁላሎች | Breakage classification |
| Dirty eggs | Dirty eggs | የቆሸሹ እንቁላሎች | Dirty classification |
| Egg classes do not total correctly | The egg numbers do not agree | የእንቁላል ቁጥሮቹ አይዛመዱም | Egg classification mismatch |
| Water consumed | Water used | የተጠቀመ ውሃ | Water intake metric |
| No illness or treatment | No health problem today | ዛሬ የጤና ችግር የለም | No health event attestation |
| No birds died | No bird deaths today | ዛሬ የሞተ ዶሮ የለም | Zero-mortality attestation |
| Suspected illness | Health problem | የጤና ችግር | Disease event |
| Medicine given to sick birds | Treatment given | የተሰጠ ሕክምና | Treatment event |
| Medicine amount | Medicine used | የተጠቀመ መድኃኒት | Inventory-backed dosage |
| Scheduled vaccine was given | Vaccination completed | ክትባቱ ተሰጥቷል | Schedule completion |
| Vaccine amount | Vaccine used | የተጠቀመ ክትባት | Vaccine stock issue |
| Reason birds died | Cause of death | የሞት ምክንያት | Mortality cause allocation |
| No supplies consumed | No supplies used today | ዛሬ ምንም እቃ አልተጠቀምንም | Zero-usage attestation |

## Stock, sales, and corrections

| Meaning | English shown to manager | Approved Amharic | Avoid in primary workflow |
|---|---|---|---|
| Stored item quantity | Stock | ክምችት | Inventory position |
| Storage location | Warehouse | መጋዘን | Stock node |
| New stock delivered | Stock received | የገባ ክምችት | Receipt movement |
| Stock consumed | Stock used | የተጠቀመ ክምችት | Canonical stock issue |
| Counted stock differs | Count does not match | ቆጠራው አይዛመድም | Physical variance |
| Egg movement check | Eggs produced, sold, and remaining | የተመረተ፣ የተሸጠና የቀረ እንቁላል | Egg custody |
| Protected correction request | Ask the CEO to approve this change | ይህን ለውጥ ዋና ሥራ አስፈጻሚው እንዲያጸድቅ ይጠይቁ | Governed correction |
| Automated evidence check | Check the records again | መዝገቦቹን እንደገና ያረጋግጡ | Deterministic recheck |
| Work assigned by the CEO | Assigned work | የተመደበ ሥራ | Action event |
| Manager starts assigned work | Start work | ሥራውን ጀምር | Acknowledge action |
| Manager reports the fix | Send completion to the CEO | መጠናቀቁን ለዋና ሥራ አስፈጻሚው ላክ | Completion submitted |
| Cost only, no stock change | Record an expense | ወጪ መዝግብ | Financial posting |

## Stock item types

Use these types when registering a warehouse item. A stock type tells the system where an item may be used; it does not describe the quantity or cost.

| Meaning | English shown to manager | Approved Amharic | Typical examples and use |
|---|---|---|---|
| Feed given to birds | Feed | መኖ | Starter, grower, finisher, layer mash, concentrates. Recorded through Feed Control. |
| Medicine used to treat illness | Medicine | መድኃኒት | Antibiotics or other approved treatments. Issued from a Health Log treatment. |
| Product used to prevent a scheduled disease | Vaccine | ክትባት | Newcastle, Gumboro, fowl pox, and other approved vaccines. Issued when vaccination is completed. |
| Nutritional support that is not the main feed | Vitamin or supplement | ቫይታሚን ወይም ተጨማሪ ምግብ | Vitamins, minerals, electrolytes, probiotics, and supplements. |
| Material used to reduce disease entry or spread | Biosecurity supply | የባዮሴኪዩሪቲ እቃ | Disinfectant, footbath chemical, protective clothing, gloves, and masks. |
| Material used for routine cleaning | Cleaning supply | የጽዳት እቃ | Soap, detergent, brushes, and cleaning chemicals. |
| Material placed on the poultry-house floor | Litter or bedding | የዶሮ ቤት ንጣፍ | Wood shavings, straw, or another approved bedding material. |
| Item used to hold, protect, or transport eggs or products | Packaging | ማሸጊያ እቃ | Egg trays, cartons, bags, labels, and wrapping material. |
| Reusable farm tool or replaceable machine component | Equipment or spare part | መሣሪያ ወይም መለዋወጫ | Drinkers, feeders, bulbs, belts, motors, and repair parts. |
| Routine item that does not fit another controlled category | General supply | አጠቃላይ የሥራ እቃ | Stationery and other approved consumable farm supplies. |

## Stock quantity and reorder language

| Meaning | English shown to manager | Approved Amharic | Avoid in primary workflow |
|---|---|---|---|
| Amount currently available | Available stock | አሁን ያለ ክምችት | On-hand balance |
| Unit used to count the item | Unit | መለኪያ | Unit of measure |
| Cost for one unit | Cost per unit | የአንድ መለኪያ ዋጋ | Unit cost |
| Lowest safe amount before purchasing more | Reorder level | እንደገና ለመግዛት የሚያስጠነቅቅ መጠን | Reorder threshold |
| Stock has reached or fallen below its reorder level | Stock is running low | ክምችቱ እያለቀ ነው | Low-stock exception |
| No usable quantity remains | Out of stock | ክምችት አልቋል | Zero on-hand balance |
| New item added to the organization’s item list | Register a new item | አዲስ እቃ መዝግብ | Catalogue creation |
| More of an existing item arrives | Receive more stock | ተጨማሪ ክምችት ተቀበል | Receipt posting |
| Physical shelf quantity recorded by a manager | Count the stock | ክምችቱን ቁጠር | Physical-count session |

## Status and recovery language

| Meaning | English shown to manager | Approved Amharic | Avoid in primary workflow |
|---|---|---|---|
| Nothing entered | Not started | አልተጀመረም | Empty state |
| Saved only on device | Draft on tablet | በታብሌቱ ላይ ተቀምጧል | Local persistence |
| Awaiting connection/server | Waiting to sync | ለመላክ በመጠበቅ ላይ | Pending mutation |
| Server accepted evidence | Complete | ተጠናቋል | Authoritatively satisfied |
| Manager must act | Needs attention | እርምጃ ያስፈልጋል | Exception state |
| Values changed elsewhere | This record changed. Review the latest values. | ይህ መዝገብ ተቀይሯል። አዲሱን መረጃ ይመልከቱ። | Stale revision conflict |
| Insufficient warehouse amount | There is not enough stock. | በቂ ክምችት የለም። | Negative-balance violation |
| Work date is too old | This date is outside the allowed entry period. | ይህ ቀን ከተፈቀደው የመመዝገቢያ ጊዜ ውጭ ነው። | Operating window expired |
| Required earlier work is unsent | Send the earlier work first. | ቀድሞ የተሠራውን መጀመሪያ ይላኩ። | Dependency incomplete |
| Item type is not allowed here | Choose the correct type of stock item. | ትክክለኛውን የክምችት እቃ ይምረጡ። | Category restriction |
| Work cannot be found | This work is no longer available. Refresh Today. | ይህ ሥራ ከእንግዲህ የለም። የዛሬን ሥራ እንደገና ያድሱ። | Source not found |

## Performance language

| Technical meaning | English shown to manager | Approved Amharic |
|---|---|---|
| Hen-day egg production (HDEP) | Egg production compared with the flock’s age | የእንቁላል ምርት ከመንጋው ዕድሜ ጋር ሲነጻጸር |
| Feed conversion ratio (FCR) | Feed used for each kilogram of weight gained | ለእያንዳንዱ ኪሎ ግራም ክብደት ጭማሪ የተጠቀመ መኖ |
| Feed variance | Feed used compared with the plan | የተጠቀመው መኖ ከዕቅዱ ጋር ሲነጻጸር |
| Mortality rate | Birds that died compared with the flock | የሞቱ ዶሮዎች ከመንጋው ጋር ሲነጻጸር |

## Partner review checklist

- [x] Confirm that each Amharic phrase is natural in spoken farm use, not merely a literal translation.
- [x] Confirm the preferred words for flock, house, feed, stock, treatment, vaccination, cull, transfer, and mortality.
- [x] Review every manager-facing Today term with a poultry practitioner.
- [x] Replace requested wording with the partner's preferred farm term.
- [x] Confirm the glossary is suitable for implementation.
- [x] Record the review date, outcome, and approved glossary version.

## Partner approval record

The product owner relayed the poultry partner's confirmation. The partner approved the glossary with one required wording change: **Pullet - ቄብ**. That change is included below, so the terminology review is complete.

| Field | Review value |
|---|---|
| Glossary version reviewed | 2026-09-22-draft-2 |
| Reviewer | Product owner's poultry partner |
| Reviewer role | Poultry practitioner and farm partner |
| Confirmation recorded by | Product owner |
| Review date | 2026-09-23 |
| Review outcome | Approved after requested terminology change |
| Required wording change | Pullet - ቄብ |
| Approved glossary version | 2026-09-23-approved-1 |

## Suggested wording changes

Use one row for each phrase that should change. Add another page if more space is needed.

| Term or glossary row | Suggested English | Suggested Amharic | Why this is clearer on a farm |
|---|---|---|---|
| Pullet | Pullet | ቄብ | Preferred term supplied by the poultry partner. |
| 2. |  |  |  |
| 3. |  |  |  |
| 4. |  |  |  |

## Final sign-off

| Field | Review value |
|---|---|
| Confirmation | Poultry partner approval relayed by the product owner |
| Date confirmed | 2026-09-23 |
| Approved glossary version | 2026-09-23-approved-1 |
