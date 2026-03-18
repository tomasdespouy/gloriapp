"""
Download all patient images from Supabase, compress to 512x512 optimized PNG, re-upload.
"""
import os
import io
from PIL import Image
from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""

# Read from .env.local if not in env
if not SUPABASE_URL:
    with open(os.path.join(os.path.dirname(__file__), "..", ".env.local")) as f:
        for line in f:
            line = line.strip()
            if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
                SUPABASE_URL = line.split("=", 1)[1].strip()
            elif line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                SERVICE_KEY = line.split("=", 1)[1].strip()

sb = create_client(SUPABASE_URL, SERVICE_KEY)

files = sb.storage.from_("patients").list()
pngs = sorted([f for f in files if f["name"].endswith(".png")], key=lambda x: x["name"])

print(f"=== Compressing {len(pngs)} images (512x512 optimized PNG) ===\n")

ok = 0
fail = 0
total_before = 0
total_after = 0

for f in pngs:
    name = f["name"]
    slug = name.replace(".png", "")
    print(f"{slug}... ", end="", flush=True)

    try:
        data = sb.storage.from_("patients").download(name)
        original_size = len(data)
        total_before += original_size

        img = Image.open(io.BytesIO(data))
        img = img.resize((512, 512), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        compressed = buf.getvalue()
        total_after += len(compressed)

        ratio = round((1 - len(compressed) / original_size) * 100)

        sb.storage.from_("patients").upload(
            name, compressed,
            file_options={"content-type": "image/png", "upsert": "true"}
        )

        print(f"{original_size // 1024}KB -> {len(compressed) // 1024}KB (-{ratio}%)")
        ok += 1
    except Exception as e:
        print(f"FAILED: {str(e)[:80]}")
        fail += 1

print(f"\n=== Done! {ok} compressed, {fail} failed ===")
print(f"Total: {total_before // (1024*1024)}MB -> {total_after // (1024*1024)}MB")
