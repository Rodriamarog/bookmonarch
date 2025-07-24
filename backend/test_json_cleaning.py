import re
import json

# Test the JSON cleaning function
response = """```json
{
    "test": "value"
}
```"""

print('Original response:')
print(repr(response))

# Test the cleaning
cleaned = re.sub(r'^```json\s*', '', response, flags=re.MULTILINE)
cleaned = re.sub(r'^```\s*$', '', cleaned, flags=re.MULTILINE)
cleaned = cleaned.strip()

print('\nCleaned response:')
print(repr(cleaned))

try:
    data = json.loads(cleaned)
    print('\nJSON parsing successful!')
    print(data)
except Exception as e:
    print(f'\nJSON parsing failed: {e}')