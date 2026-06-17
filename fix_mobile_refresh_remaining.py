from pathlib import Path
import re

FILES = [
    Path("app/mobile/products/page.tsx"),
    Path("app/mobile/products/[id]/page.tsx"),
    Path("app/mobile/finance/daily/page.tsx"),
    Path("app/mobile/orders/page.tsx"),
]

HELPER = '''async function {name}<T>(path: string): Promise<T> {{
  return apiJson<T>(path, {{
    redirectOnUnauthorized: true,
    timeoutMs: 30000,
  }} as any);
}}'''

def ensure_api_json_import(text: str) -> str:
    if 'import { apiJson } from "@/lib/api";' in text:
        return text
    return text.replace('"use client";\n\n', '"use client";\n\nimport { apiJson } from "@/lib/api";\n', 1)

def remove_mobile_token_import(text: str) -> str:
    text = text.replace('import { clearMobileSession, getMobileToken } from "@/lib/mobile-auth-token";\n', '')
    return text

def replace_async_helper(text: str) -> str:
    patterns = [
        r'async function\s+(\w+)<T>\s*\(\s*path\s*:\s*string\s*\)\s*:\s*Promise<T>\s*\{[\s\S]*?return\s+res\.json\(\);\s*\}',
        r'async function\s+(\w+)<T>\s*\(\s*path:string\s*\)\s*:\s*Promise<T>\s*\{[\s\S]*?return\s+res\.json\(\)\s*\}',
    ]

    for pattern in patterns:
        def repl(m):
            name = m.group(1)
            body = m.group(0)
            if (
                "getMobileToken" in body
                or "clearMobileSession" in body
                or "localStorage.removeItem" in body
                or 'window.location.href="/mobile/login"' in body
                or 'window.location.href = "/mobile/login"' in body
            ):
                return HELPER.format(name=name)
            return body

        text = re.sub(pattern, repl, text, count=1)

    return text

for path in FILES:
    if not path.exists():
        print(f"SKIP missing: {path}")
        continue

    original = path.read_text()
    text = original

    text = ensure_api_json_import(text)
    text = remove_mobile_token_import(text)
    text = replace_async_helper(text)

    if text != original:
        backup = path.with_suffix(path.suffix + ".bak")
        backup.write_text(original)
        path.write_text(text)
        print(f"PATCHED: {path}")
    else:
        print(f"NO CHANGE: {path}")
