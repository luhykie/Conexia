const COUNTRIES_API_URL =
  "https://api.first.org/data/v1/countries?limit=300";

export async function getCountryDirectory() {
  const response = await fetch(COUNTRIES_API_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Country directory is temporarily unavailable.");
  }

  const body = await response.json();
  if (body?.status !== "OK" || !body.data || Array.isArray(body.data)) {
    throw new Error("Country directory returned an invalid response.");
  }

  return Object.entries(body.data)
    .map(([iso, record]) => ({
      name: record?.country?.trim(),
      iso: iso.trim().toUpperCase(),
    }))
    .filter((country) => country.name && country.iso);
}
