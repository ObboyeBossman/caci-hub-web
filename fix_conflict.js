const fs = require('fs');
let t = fs.readFileSync('src/assets/members.sql', 'utf8');
t = t.replace(/\);$/, ') ON CONFLICT (membership_number) DO NOTHING;');
fs.writeFileSync('src/assets/members.sql', t);
