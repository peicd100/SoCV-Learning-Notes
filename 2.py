from pathlib import Path

p = Path(r"docs\theme\tts.html")
css = p.read_text(encoding="utf-8")

repl = {
    "#d6b77c": "#7ad3ff",
    "#f0d49a": "#7ad3ff",
    "#e9c98b": "#7ad3ff",
    "rgba(214, 183, 124": "rgba(122, 211, 255",
    "rgba(214,183,124": "rgba(122,211,255",
}

for a, b in repl.items():
    css = css.replace(a, b)

p.write_text(css, encoding="utf-8")
print("OK: gold -> code-blue")
