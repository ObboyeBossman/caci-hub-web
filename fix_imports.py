import os
import glob

def fix_imports():
    pattern = 'src/modules/membership/**/*.ts'
    files = glob.glob(pattern, recursive=True)
    import_stmt = "import { formatName } from '@modules/membership/utils/member-helpers'\n"
    
    for filename in files:
        with open(filename, 'r') as f:
            content = f.read()
            
        if 'formatName(' in content and 'import { formatName } from ' not in content and 'import ' not in content:
            # Maybe there are no imports, append at top
            updated = import_stmt + content
            with open(filename, 'w') as f:
                f.write(updated)
            print("Fixed: " + filename)
            
        elif 'formatName(' in content and 'formatName' not in content[:content.find('formatName(')]:
            # Import is missing
            # If an import statements exists for member-helpers, let's just append our new import at top to be safe
            if 'member-helpers' in content:
                # To be completely safe and avoid syntax errors with duplicated imports,
                # we just insert our alias import right after the first import or at top.
                import_idx = content.find('import')
                if import_idx != -1:
                    updated = content[:import_idx] + import_stmt + content[import_idx:]
                else:
                    updated = import_stmt + content
            else:
                import_idx = content.find('import')
                if import_idx != -1:
                    updated = content[:import_idx] + import_stmt + content[import_idx:]
                else:
                    updated = import_stmt + content
            
            with open(filename, 'w') as f:
                f.write(updated)
            print("Fixed: " + filename)

if __name__ == '__main__':
    fix_imports()
