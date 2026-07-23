import fs from 'fs';

let adminContent = fs.readFileSync('src/admin_portal/home.ts', 'utf-8');
adminContent = adminContent.replace(
  `<span class="font-extrabold text-[10px] text-caci-blue">CACI</span>`,
  `<img src="/caci-logo.jpeg" alt="CACI Logo" class="w-full h-full object-cover">`
);
adminContent = adminContent.replace(
  `<span class="font-black text-xs text-white">CACI</span>`,
  `<img src="/caci-logo.jpeg" alt="CACI Logo" class="w-full h-full object-cover">`
);
adminContent = adminContent.replace(
  `<span class="font-bold text-xs text-caci-blue">CACI</span>`,
  `<img src="/caci-logo.jpeg" alt="CACI Logo" class="w-full h-full object-cover">`
);
fs.writeFileSync('src/admin_portal/home.ts', adminContent);

let memberContent = fs.readFileSync('src/members_portal/home.ts', 'utf-8');
memberContent = memberContent.replace(
  `<span class="font-extrabold text-[10px] text-caci-blue">CACI</span>`,
  `<img src="/caci-logo.jpeg" alt="CACI Logo" class="w-full h-full object-cover">`
);
memberContent = memberContent.replace(
  `<span class="font-bold text-xs text-caci-blue">CACI</span>`,
  `<img src="/caci-logo.jpeg" alt="CACI Logo" class="w-full h-full object-cover">`
);
fs.writeFileSync('src/members_portal/home.ts', memberContent);

