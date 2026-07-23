import fs from 'fs';

let content = fs.readFileSync('src/admin_portal/store.ts', 'utf-8');

// Add SERMONS
const dataStoresIndex = content.indexOf('export let AUDIT_LOGS');
const newStore = `export let SERMONS: Tables<'sermons'>[] = [];\n`;
content = content.slice(0, dataStoresIndex) + newStore + content.slice(dataStoresIndex);

const aliasesIndex = content.indexOf('export { AUDIT_LOGS as auditLogs };');
const newAlias = `export { SERMONS as sermons };\n`;
content = content.slice(0, aliasesIndex) + newAlias + content.slice(aliasesIndex);

// Add fetch
const auditLogsFetchIndex = content.indexOf('// 7. Fetch audit logs');
const newFetch = `
    // 8. Fetch sermons
    const { data: sermonsData, error: sermonsErr } = await supabase
      .from('sermons')
      .select('*')
      .order('date', { ascending: false });
    if (sermonsErr) throw sermonsErr;
    SERMONS = sermonsData || [];
`;
const notifyIndex = content.indexOf('// Notify listeners');
content = content.slice(0, notifyIndex) + newFetch + content.slice(notifyIndex);

fs.writeFileSync('src/admin_portal/store.ts', content);
console.log("Admin store updated");
