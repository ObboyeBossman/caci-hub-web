import { execSync } from 'child_process'
console.log('Fetching policies via npm run db:prod:diff...')
execSync('npm run db:prod:diff > temp_diff.sql')
