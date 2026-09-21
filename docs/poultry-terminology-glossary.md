# Farm Operations Terminology Glossary

Status: **Draft for poultry-partner review**
Scope: Farm Manager Today workflow and its direct validation messages
Last updated: 2026-09-21

This glossary favors short instructions that a Farm Manager can act on immediately. It deliberately avoids audit, accounting, and software terminology in the primary workflow. Technical terms remain available in advanced history views.

## Approved-source basis

- [SNV-RAYEE Poultry Amharic Manual](https://www.scribd.com/document/923086592/Poultry-Amharic-Manual) — Amharic poultry husbandry vocabulary and farmer-facing phrasing.
- [ILO On-job-training manual for the poultry sector](https://researchrepository.ilo.org/esploro/outputs/manual/On-job-training-manual-for-the-poultry-sector/995673745302676) — practical Ethiopian poultry production workflow and competency framing.

The Amharic below is an implementation draft. A bilingual poultry practitioner must approve or replace every row before the broad bilingual release.

## Core navigation and daily work

| Meaning | English shown to manager | Amharic draft | Avoid in primary workflow |
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

## Stock, sales, and corrections

| Meaning | English shown to manager | Amharic draft | Avoid in primary workflow |
|---|---|---|---|
| Stored item quantity | Stock | ክምችት | Inventory position |
| Storage location | Warehouse | መጋዘን | Stock node |
| New stock delivered | Stock received | የገባ ክምችት | Receipt movement |
| Stock consumed | Stock used | የተጠቀመ ክምችት | Canonical stock issue |
| Counted stock differs | Count does not match | ቆጠራው አይዛመድም | Physical variance |
| Egg movement check | Eggs produced, sold, and remaining | የተመረተ፣ የተሸጠና የቀረ እንቁላል | Egg custody |
| Protected correction request | Ask the CEO to approve this change | ይህን ለውጥ ዋና ሥራ አስፈጻሚው እንዲያጸድቅ ይጠይቁ | Governed correction |
| Automated evidence check | Check the records again | መዝገቦቹን እንደገና ያረጋግጡ | Deterministic recheck |

## Status and recovery language

| Meaning | English shown to manager | Amharic draft | Avoid in primary workflow |
|---|---|---|---|
| Nothing entered | Not started | አልተጀመረም | Empty state |
| Saved only on device | Draft on tablet | በታብሌቱ ላይ ተቀምጧል | Local persistence |
| Awaiting connection/server | Waiting to sync | ለመላክ በመጠበቅ ላይ | Pending mutation |
| Server accepted evidence | Complete | ተጠናቋል | Authoritatively satisfied |
| Manager must act | Needs attention | እርምጃ ያስፈልጋል | Exception state |
| Values changed elsewhere | This record changed. Review the latest values. | ይህ መዝገብ ተቀይሯል። አዲሱን መረጃ ይመልከቱ። | Stale revision conflict |
| Insufficient warehouse amount | There is not enough stock. | በቂ ክምችት የለም። | Negative-balance violation |

## Performance language

| Technical meaning | English shown to manager | Amharic draft |
|---|---|---|
| Hen-day egg production (HDEP) | Egg production compared with the flock’s age | የእንቁላል ምርት ከመንጋው ዕድሜ ጋር ሲነጻጸር |
| Feed conversion ratio (FCR) | Feed used for each kilogram of weight gained | ለእያንዳንዱ ኪሎ ግራም ክብደት ጭማሪ የተጠቀመ መኖ |
| Feed variance | Feed used compared with the plan | የተጠቀመው መኖ ከዕቅዱ ጋር ሲነጻጸር |
| Mortality rate | Birds that died compared with the flock | የሞቱ ዶሮዎች ከመንጋው ጋር ሲነጻጸር |

## Partner review checklist

- [ ] Confirm that each Amharic phrase is natural in spoken farm use, not merely a literal translation.
- [ ] Confirm the preferred words for flock, house, feed, stock, treatment, vaccination, cull, transfer, and mortality.
- [ ] Read every Today instruction aloud with a working Farm Manager.
- [ ] Replace phrases that require explanation with shorter familiar wording.
- [ ] Confirm number, unit, date, and ETB examples on a real tablet.
- [ ] Record reviewer name, farm, role, date, and approved glossary version.
