import sys
from PIL import Image
img = Image.open(sys.argv[1])
img = img.resize((512, 512), Image.LANCZOS)
img.save(sys.argv[2], optimize=True)
