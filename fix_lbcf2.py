import re

# Read the file
with open('src/data/lbcf2.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Regex patterns to remove footnote markers:
# Pattern 1: lowercase preceded by lowercase, followed by space/punctuation (like 'b' in "theb ")
pattern1 = r"(?<=[a-z])[a-z](?=[\s,.:;!?\'\"])"
# Pattern 2: lowercase followed by 2+ lowercase letters (like 'a' in "arule", 'd' in "dking")
pattern2 = r"[a-z](?=[a-z]{2,})"

# Combine patterns
pattern = pattern1 + "|" + pattern2

# Apply the regex
fixed_content = re.sub(pattern, '', content)

# Count and show examples of replacements
chars_removed = len(content) - len(fixed_content)
print(f"Original file size: {len(content)} characters")
print(f"Fixed file size: {len(fixed_content)} characters")
print(f"Characters removed: {chars_removed}")

# Show some examples of fixes
examples_to_find = ['arule', 'bof', 'dwriting', 'theb', 'cpriest', 'dking', 'einspiration']
print("\nExamples found in original:")
for example in examples_to_find:
    if example in content:
        print(f"  - '{example}' found")
    else:
        print(f"  - '{example}' not found")

# Write the fixed content back
with open('src/data/lbcf2.js', 'w', encoding='utf-8') as f:
    f.write(fixed_content)

if chars_removed > 0:
    print(f"\nSuccess! File updated - removed {chars_removed} marker characters")
else:
    print("\nWarning: No markers were found/removed")

