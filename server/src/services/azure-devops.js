export function listProjects() {
  const raw = process.env.ADO_PROJECTS || '';
  return raw
    .split(',')
    .map((project) => project.trim())
    .filter(Boolean);
}

export function isAzureConfigured() {
  return !!(process.env.ADO_PAT && process.env.ADO_ORG && listProjects().length);
}

export async function fetchWorkItem(project, workItemId) {
  const org = process.env.ADO_ORG;
  const pat = process.env.ADO_PAT;
  if (!org || !pat) {
    const err = new Error('Azure DevOps is not configured on the server');
    err.status = 503;
    throw err;
  }

  const id = String(workItemId ?? '').trim();
  if (!/^\d+$/.test(id)) {
    const err = new Error('Work item ID must be a number');
    err.status = 400;
    throw err;
  }

  const projectName = String(project || '').trim();
  if (!projectName) {
    const err = new Error('This room has no Azure DevOps project');
    err.status = 400;
    throw err;
  }

  const allowed = listProjects();
  if (allowed.length && !allowed.includes(projectName)) {
    const err = new Error('Project is not allowed for this deployment');
    err.status = 400;
    throw err;
  }

  const base = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(projectName)}`;
  const apiUrl = `${base}/_apis/wit/workitems/${id}?api-version=7.1`;

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
    },
  });

  if (res.status === 404) {
    const err = new Error('Work item not found in this project');
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`Azure DevOps request failed (${res.status})`);
    err.status = 502;
    throw err;
  }

  const body = await res.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    const err = new Error('Azure DevOps returned an invalid response');
    err.status = 502;
    throw err;
  }
  const fields = data.fields || {};
  const resolvedId = String(data.id ?? id);
  const title = String(fields['System.Title'] || '').trim() || 'Untitled';
  const workItemType = String(fields['System.WorkItemType'] || '').trim() || 'Work Item';

  return {
    workItemId: resolvedId,
    workItemType,
    title,
    url: `${base}/_workitems/edit/${resolvedId}`,
  };
}
