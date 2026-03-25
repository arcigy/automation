export function detectSlovakSalutation(firstName: string, lastName: string): "pán" | "pani" {
  const name = firstName.toLowerCase().trim();
  const sur = lastName.toLowerCase().trim();

  // Basic Slovak gender rules:
  // 1. Last names ending in -á, -ová, -eva are female
  if (sur.endsWith("á") || sur.endsWith("ová") || sur.endsWith("eva") || sur.endsWith("ská")) {
    return "pani";
  }

  // 2. Common female names (including international ones)
  const femaleNames = ["sarah", "miriam", "karin", "vivien", "ester", "nicole", "denisa", "viktoria"];
  if (femaleNames.includes(name)) return "pani";

  // 3. Common female first names ending in -a (with exceptions)
  const maleNamesEndingInA = ["pala", "palo", "miro", "mato", "kuba", "barta", "jura", "attila", "sava", "bonifaca"];
  if (name.endsWith("a") && !maleNamesEndingInA.includes(name)) {
    return "pani";
  }

  // Default to male
  return "pán";
}
