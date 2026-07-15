import fs from 'fs';

let content = fs.readFileSync('src/admin_portal/home.ts', 'utf-8');

// Add import
const importIndex = content.indexOf('import { renderSettingsTab }');
content = content.slice(0, importIndex) + "import { renderSermonsTab } from './tabs/sermons';\n" + content.slice(importIndex);

// Add to nav
const sysSecIndex = content.indexOf('<p class="text-[10px] uppercase font-bold text-blue-300/70 px-3 tracking-widest mb-1">System Security</p>');
const newNav = `
            <div class="space-y-1.5 mb-6">
              <button data-tab="sermons" class="admin-tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white hover:bg-white/10">
                <div class="flex items-center space-x-3">
                  <i data-lucide="book-open" class="w-4.5 h-4.5"></i><span>Sermons</span>
                </div>
              </button>
            </div>
            
            `;
content = content.slice(0, sysSecIndex) + newNav + content.slice(sysSecIndex);

// Add to valid tabs
content = content.replace("['dashboard', 'members', 'groups', 'broadcasts', 'accounts', 'audit', 'settings']", "['dashboard', 'members', 'groups', 'broadcasts', 'accounts', 'audit', 'settings', 'sermons']");

// Add to render switch
const renderCaseIndex = content.indexOf("case 'settings': renderSettingsTab(container); break;");
content = content.slice(0, renderCaseIndex) + "case 'sermons': renderSermonsTab(container); break;\n    " + content.slice(renderCaseIndex);

fs.writeFileSync('src/admin_portal/home.ts', content);
console.log("Admin home updated");
