with open('useDatabase.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'useDatabase' in line or 'export const' in line:
        print(f"Line {i+1}: {line.strip()}")
