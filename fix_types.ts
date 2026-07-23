import fs from 'fs';

let content = fs.readFileSync('src/types/database.types.ts', 'utf-8');

const newSermonsType = `      sermons: {
        Row: {
          id: string
          title: string
          speaker: string
          date: string
          description: string | null
          scripture_reference: string | null
          audio_url: string | null
          video_url: string | null
          cover_image_url: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          title: string
          speaker: string
          date: string
          description?: string | null
          scripture_reference?: string | null
          audio_url?: string | null
          video_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          title?: string
          speaker?: string
          date?: string
          description?: string | null
          scripture_reference?: string | null
          audio_url?: string | null
          video_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }`;

const settingsStartIndex = content.indexOf('assembly_settings: {');
content = content.slice(0, settingsStartIndex) + newSermonsType + ',\n' + content.slice(settingsStartIndex);
fs.writeFileSync('src/types/database.types.ts', content);
console.log("Types updated");
