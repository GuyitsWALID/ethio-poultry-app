const en = {
  title: "Add branch structure", name: "Branch name", location: "Location", farms: "Farms and empty houses",
  help: "This creates structure only. Place birds later through approved Batch cycles. House capacity is not a starting bird count.",
  manager: "Assign an existing Farm Manager (optional)", later: "Assign later", managerHelp: "Includes all farm-owned warehouses. Create new manager accounts in Access & Users first.",
  farm: "Farm name", house: "House name", capacity: "House capacity", type: "House type", addFarm: "Add farm", addHouse: "Add house", remove: "Remove",
  layer: "Layer", broiler: "Broiler", rearing: "Rearing", parent_stock: "Parent stock",
  cancel: "Close", save: "Create structure", saving: "Saving…", failed: "Could not save. Check access and values, then retry.",
  managerFailed: "Could not load managers. Retry before assigning, or create structure without an assignment.", retry: "Retry",
  success: "Structure saved. No birds placed. Confirm assignments, then propose actual placement through Batch cycles.",
  cycles: "Open Batch cycles", access: "Open Access & Users",
};
const am: typeof en = {
  title: "የቅርንጫፍ መዋቅር ያክሉ", name: "የቅርንጫፍ ስም", location: "አካባቢ", farms: "እርሻዎች እና ባዶ ቤቶች",
  help: "ይህ መዋቅር ብቻ ይፈጥራል። ዶሮዎችን በኋላ በተፈቀደው የባች ዑደት ሂደት ያስገቡ። የቤት አቅም የመጀመሪያ ዶሮ ብዛት አይደለም።",
  manager: "ያለ የእርሻ አስተዳዳሪ ይመድቡ (አማራጭ)", later: "በኋላ ይመድቡ", managerHelp: "ሁሉንም የእርሻውን መጋዘኖች ያካትታል። አዲስ መለያ በመጀመሪያ በመዳረሻ እና ተጠቃሚዎች ይፍጠሩ።",
  farm: "የእርሻ ስም", house: "የቤት ስም", capacity: "የቤት አቅም", type: "የቤት ዓይነት", addFarm: "እርሻ ያክሉ", addHouse: "ቤት ያክሉ", remove: "አስወግድ",
  layer: "እንቁላል ጣይ", broiler: "የስጋ ዶሮ", rearing: "እድገት", parent_stock: "ወላጅ መንጋ",
  cancel: "ዝጋ", save: "መዋቅር ፍጠር", saving: "በማስቀመጥ ላይ…", failed: "ሊቀመጥ አልቻለም። ፈቃድና መረጃውን አረጋግጠው እንደገና ይሞክሩ።",
  managerFailed: "አስተዳዳሪዎች ሊጫኑ አልቻሉም። እንደገና ይሞክሩ ወይም ያለ ምደባ መዋቅር ይፍጠሩ።", retry: "እንደገና ሞክር",
  success: "መዋቅሩ ተቀምጧል። ዶሮዎች አልገቡም። ምደባዎችን ያረጋግጡና በባች ዑደቶች ትክክለኛውን የማስገባት ጥያቄ ያቅርቡ።",
  cycles: "የባች ዑደቶችን ክፈት", access: "መዳረሻ እና ተጠቃሚዎችን ክፈት",
};
export const branchSetupCopy = {en, am};
