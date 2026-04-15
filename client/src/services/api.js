const BASE = "/api";

export async function extractRequirements(rfpFile) {
  const form = new FormData();
  form.append("rfp", rfpFile);

  const res = await fetch(`${BASE}/extract`, { method: "POST", body: form });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function validateDocuments(rfpFile, vendorFile) {
  const form = new FormData();
  form.append("rfp", rfpFile);
  form.append("vendor", vendorFile);

  const res = await fetch(`${BASE}/validate`, { method: "POST", body: form });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function pingServer() {
  const res = await fetch(`${BASE}/ping`);
  return res.json();
}