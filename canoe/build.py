# Inlines bg.jpg into index.src.html -> index.html
import base64
b = base64.b64encode(open('bg.jpg','rb').read()).decode()
open('index.html','w').write(open('index.src.html').read().replace('__BG_BASE64__', b))
