import fs from 'fs';

let content = fs.readFileSync('src/members_portal/store.ts', 'utf-8');

// remove lines 140-145
const startIdx = content.indexOf('}export let SERMONS: any[] = [];');
const fix = `
    const { data: sermons } = await supabase.from('sermons').select('*').order('date', { ascending: false });
    SERMONS = sermons || [];

    notifyStateChange();
  } catch (error) {
    console.error("[store] syncMemberData failed:", error);
    throw error; // Re-throw so the UI can handle it
  }
}

export let SERMONS: any[] = [];
export { SERMONS as sermons };
`;
// find where `notifyStateChange();` is
const notifyIdx = content.indexOf('notifyStateChange();');
content = content.slice(0, notifyIdx) + fix;

fs.writeFileSync('src/members_portal/store.ts', content);
